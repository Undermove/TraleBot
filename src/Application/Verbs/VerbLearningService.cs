using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Application.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>What the session director knows about the learner in general — not about this verb.</summary>
/// <param name="CanType">False for a beginner who has not finished the alphabet: no typing tasks.</param>
public record VerbLearnerProfile(string? Level, bool CanType, int DictionarySize, int DictionaryVerbs, int VerbsLearned);

/// <summary>What the director remembers about this verb between sessions.</summary>
/// <param name="RecentScenes">Recent sessions, oldest first; each is its scene types joined by '+'.</param>
public record VerbMemory(int SessionsPlayed, IReadOnlyList<string> RecentScenes, bool StoryCompleted, bool ExamPassed);

/// <summary>A session that was started and not finished — the mini-app continues it.</summary>
public record ActiveVerbSession(Guid Id, string PlanJson, int Scene, int Done);

/// <param name="Family">The verb's family, if it has one: decides whether its session is the short prefix session.</param>
public record VerbLearningState(
    VerbProgressState Progress, VerbLevel Level, VerbMemory Memory, VerbLearnerProfile Learner, ActiveVerbSession? Session,
    VerbFamilyState? Family = null);

/// <summary>
/// Where a session is after an answer, as the mini-app reports it. The same report is sent again
/// until it gets through, so everything in it is safe to apply twice.
/// </summary>
/// <param name="PlanJson">The composed session; needed with the first report only.</param>
/// <param name="Scenes">Scene types of the session, in order — remembered when it finishes.</param>
public record VerbSessionReport(
    Guid SessionId,
    string? PlanJson,
    int Scene,
    int Done,
    IReadOnlyCollection<VerbFormStep> Forms,
    bool Finished,
    IReadOnlyList<string> Scenes,
    bool StoryCompleted,
    int ExamAsked,
    int ExamCorrect);

/// <param name="XpEarned">XP this session earned (0 for an unfinished one or past the daily cap).</param>
/// <param name="Progress">The learner's mini-app progress (XP, streak) after a finished session.</param>
public record VerbSessionOutcome(VerbLearningState State, int XpEarned, object? Progress);

/// <summary>
/// A learner's verb as its own thing: level, memory of past sessions and the session in progress.
/// The mini-app composes a session (which scenes, which forms); this service stores where it is,
/// derives the level from form progress (<see cref="VerbLevelRules"/>), and credits a finished
/// session once — XP and an active day, like a finished lesson.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbLearningService(
    ITraleDbContext dbContext,
    VerbProgressService formProgress,
    DictionaryVerbsQuery dictionaryVerbs,
    IProgressCalculator progressCalculator,
    VerbFamilyQuery families)
{
    public const int MaxPlanLength = 16_000;

    /// <summary>An unfinished session older than this is forgotten: the learner starts a fresh one.</summary>
    public static readonly TimeSpan ResumeWindow = TimeSpan.FromHours(12);

    /// <summary>Scene types a session may consist of — the same names the mini-app's director uses.</summary>
    public static readonly IReadOnlySet<string> SceneTypes = new HashSet<string>
    {
        "story", "meet", "pick", "time", "bones", "builder", "phrases", "warmup", "exam",
        PrefixIntroScene, PrefixScene, PrefixCheckScene
    };

    /// <summary>Scenes of a family member's prefix session: the introduction, the play and the check.</summary>
    public const string PrefixIntroScene = "prefixintro";
    public const string PrefixScene = "prefix";

    /// <summary>The scene whose tally is judged by <see cref="VerbLevelRules.PrefixCheckPassed"/> instead of the exam rule.</summary>
    public const string PrefixCheckScene = "prefixcheck";

    /// <summary>One remembered session is its scene types joined by this: "meet+time+phrases".</summary>
    public const char SceneSeparator = '+';

    /// <summary>Null when there is no such verb.</summary>
    public async Task<VerbLearningState?> GetAsync(User user, string lemma, int alphabetLessons, DateTime now, CancellationToken ct)
    {
        var progress = await formProgress.GetAsync(user.Id, lemma, now, ct);
        if (progress == null)
        {
            return null;
        }

        var row = await dbContext.UserVerbs
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.UserId == user.Id && v.Verb.Lemma == lemma, ct);

        var oldest = now - ResumeWindow;
        var session = !progress.CanLearn ? null : await dbContext.VerbSessions
            .AsNoTracking()
            .Where(s => s.UserId == user.Id && s.Verb.Lemma == lemma && s.FinishedAtUtc == null && s.UpdatedAtUtc >= oldest)
            .OrderByDescending(s => s.UpdatedAtUtc)
            .Select(s => new ActiveVerbSession(s.Id, s.PlanJson, s.Scene, s.Done))
            .FirstOrDefaultAsync(ct);

        return new VerbLearningState(
            progress,
            LevelOf(row, progress),
            new VerbMemory(
                row?.SessionsPlayed ?? 0,
                ParseScenes(row?.RecentScenesJson),
                row?.StoryCompleted ?? false,
                row?.ExamPassedAtUtc != null),
            await LearnerAsync(user, alphabetLessons, ct),
            session,
            // A model-made record never joins a family, even under a family verb's lemma.
            progress.Curated ? await families.StateAsync(user.Id, lemma, ct) : null);
    }

    /// <summary>
    /// Applies a session report and returns the verb's state after it. Null when the verb is unknown,
    /// or the report does not belong to this learner and verb.
    /// </summary>
    public async Task<VerbSessionOutcome?> SaveAsync(
        User user, string lemma, VerbSessionReport report, int alphabetLessons, DateTime now, CancellationToken ct)
    {
        var verb = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Lemma == lemma)
            .Select(v => new { v.Id })
            .FirstOrDefaultAsync(ct);
        if (verb == null)
        {
            return null;
        }

        var session = await dbContext.VerbSessions.FirstOrDefaultAsync(s => s.Id == report.SessionId, ct);
        if (session != null && (session.UserId != user.Id || session.VerbId != verb.Id))
        {
            return null;
        }

        if (session == null)
        {
            if (string.IsNullOrWhiteSpace(report.PlanJson) || report.PlanJson.Length > MaxPlanLength)
            {
                return null;
            }

            session = new VerbSession
            {
                Id = report.SessionId,
                UserId = user.Id,
                VerbId = verb.Id,
                PlanJson = report.PlanJson,
                StartedAtUtc = now,
                UpdatedAtUtc = now
            };
            dbContext.VerbSessions.Add(session);
        }

        var progress = await formProgress.SaveAsync(user.Id, lemma, report.Forms, now, ct);
        if (progress == null)
        {
            return null;
        }

        var row = await dbContext.UserVerbs.FirstOrDefaultAsync(v => v.UserId == user.Id && v.VerbId == verb.Id, ct);
        if (row == null)
        {
            row = new UserVerb { Id = Guid.NewGuid(), UserId = user.Id, VerbId = verb.Id, StartedAtUtc = now };
            dbContext.UserVerbs.Add(row);
        }

        row.StoryCompleted |= report.StoryCompleted;
        row.UpdatedAtUtc = now;

        var xpEarned = 0;
        object? userProgress = null;
        if (session.FinishedAtUtc == null)
        {
            // A late or replayed report never moves the position back.
            var position = (Math.Max(0, report.Scene), Math.Max(0, report.Done));
            if (position.CompareTo((session.Scene, session.Done)) > 0)
            {
                (session.Scene, session.Done) = position;
            }

            session.UpdatedAtUtc = now;

            if (report.Finished)
            {
                session.FinishedAtUtc = now;
                row.SessionsPlayed += 1;
                row.LastPlayedAtUtc = now;
                row.RecentScenesJson = JsonSerializer.Serialize(
                    ParseScenes(row.RecentScenesJson)
                        .Append(string.Join(SceneSeparator, report.Scenes.Where(SceneTypes.Contains)))
                        .TakeLast(UserVerb.RecentSessionsKept));
                // A prefix session ends with the prefix check, not with the exam: its tally counts only
                // for a family member whose base verb is learned.
                var passed = report.Scenes.Contains(PrefixCheckScene)
                    ? progress.Curated
                      && await families.StateAsync(user.Id, lemma, ct) is { Member.Role: VerbFamilyCatalog.Member } family
                      && VerbLevelRules.PrefixCheckPassed(family.BaseLearned, report.ExamAsked, report.ExamCorrect)
                    : VerbLevelRules.ExamPassed(progress.Total, report.ExamAsked, report.ExamCorrect);
                if (passed)
                {
                    row.ExamPassedAtUtc ??= now;
                }

                var today = now.Date;
                var creditedToday = await dbContext.VerbSessions.CountAsync(
                    s => s.UserId == user.Id && s.FinishedAtUtc >= today && s.XpEarned > 0, ct);
                xpEarned = creditedToday < LearningConstants.XpRewards.VerbSessionsPerDay
                    ? LearningConstants.XpRewards.VerbSession
                    : 0;
                session.XpEarned = xpEarned;

                var miniApp = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, user.Id, ct);
                progressCalculator.CreditPractice(miniApp, xpEarned);
                userProgress = progressCalculator.SerializeProgress(miniApp);
            }
        }

        row.Level = LevelOf(row, progress);
        await dbContext.SaveChangesAsync(ct);

        var state = await GetAsync(user, lemma, alphabetLessons, now, ct);
        return state == null ? null : new VerbSessionOutcome(state, xpEarned, userProgress);
    }

    /// <summary>
    /// The learner practised the verb outside a session (a dictionary quiz answer): makes sure the
    /// verb is "theirs" and its level follows the form progress. No-op for unknown or unreviewed verbs.
    /// </summary>
    public async Task TouchAsync(Guid userId, string lemma, DateTime now, CancellationToken ct)
    {
        var progress = await formProgress.GetAsync(userId, lemma, now, ct);
        if (progress is not { CanLearn: true })
        {
            return;
        }

        var row = await dbContext.UserVerbs.FirstOrDefaultAsync(v => v.UserId == userId && v.Verb.Lemma == lemma, ct);
        if (row == null)
        {
            var verbId = await dbContext.Verbs.Where(v => v.Lemma == lemma).Select(v => v.Id).FirstAsync(ct);
            row = new UserVerb { Id = Guid.NewGuid(), UserId = userId, VerbId = verbId, StartedAtUtc = now };
            dbContext.UserVerbs.Add(row);
        }

        row.Level = LevelOf(row, progress);
        row.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The stored level never goes down; a learner who used the verb before levels existed has
    /// form progress and no row — their level is derived on the fly.
    /// </summary>
    private static VerbLevel LevelOf(UserVerb? row, VerbProgressState progress)
    {
        var derived = VerbLevelRules.Derive(
            progress.Total, progress.Forms.Select(f => f.BestStep).ToList(), row?.ExamPassedAtUtc != null);
        return row != null && row.Level > derived ? row.Level : derived;
    }

    private async Task<VerbLearnerProfile> LearnerAsync(User user, int alphabetLessons, CancellationToken ct)
    {
        var miniApp = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id, ct);
        var alphabetDone = miniApp != null && alphabetLessons > 0
            && progressCalculator.CompletedLessons(miniApp, LearningConstants.Modules.Alphabet) >= alphabetLessons;
        var dictionarySize = await dbContext.VocabularyEntries
            .CountAsync(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage, ct);
        return new VerbLearnerProfile(
            miniApp?.Level,
            CanType: alphabetDone || miniApp?.Level == LearningConstants.Levels.Intermediate,
            dictionarySize,
            dictionarySize == 0 ? 0 : await dictionaryVerbs.CountAsync(user, ct),
            await dbContext.UserVerbs.CountAsync(v => v.UserId == user.Id && v.ExamPassedAtUtc != null, ct));
    }

    private static List<string> ParseScenes(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }
}
