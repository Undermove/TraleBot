using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Application.MiniApp;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.DailyTask;

/// <summary>What the result endpoint returns: the played task, the XP credited and the mini-app progress after it.</summary>
public record DailySaved(DailyTaskDto Task, int XpEarned, object? Progress);

/// <summary>
/// The task of the day for one learner: composed once a day from their forms and dictionary
/// (<see cref="DailyTaskPlanner"/>, <see cref="CoursePlanner"/>), kept for the day so the screen and
/// the bot message agree, and played out — form outcomes go through <see cref="VerbProgressService"/>
/// so the repetition schedule stays the same as in verb sessions.
/// Service per ARCHITECTURE.md.
/// </summary>
public class DailyTaskService(
    ITraleDbContext dbContext,
    VerbProgressService verbProgress,
    IProgressCalculator progressCalculator,
    ICourseCatalog catalog)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static readonly string[] LadderTenses =
        { "present", "aorist", "imperfect", "optative", "conditional", "future" };

    private static readonly string[] Persons = { "я", "ты", "он", "мы", "вы", "они" };

    // The verb session's rules for new forms (miniapp-src/src/verbs/session/plan.ts and ladder/engine.ts):
    // how many it opens at once, from which step a form counts as settled, how many unsettled ones it allows.
    private const int NewFormsPerSession = 3;
    private const int SettledStep = 3;
    private const int MaxUnsettled = 3;
    private static readonly int[] PersonOrder = { 0, 2, 1, 3, 5, 4 };
    private static readonly string[] FirstTenses = { "present", "aorist", "future" };

    /// <summary>
    /// The order the session introduces forms in (introOrder in ladder/engine.ts): я/он/ты of the first
    /// tenses, then «я» of the rest, then мы/они/вы of the first tenses, then everything else.
    /// </summary>
    private static IEnumerable<(string Tense, int Person)> IntroOrder(IEnumerable<(string Tense, int Person)> cells) =>
        cells.OrderBy(c =>
        {
            var person = Array.IndexOf(PersonOrder, c.Person);
            var first = FirstTenses.Contains(c.Tense);
            var round = first ? (person < 3 ? 0 : 2) : (person == 0 ? 1 : 3);
            return round * 1000 + person * 10 + Array.IndexOf(LadderTenses, c.Tense);
        });

    /// <summary>Today's task; composed on the first call of the day.</summary>
    public async Task<DailyTaskDto> GetAsync(User user, DateTime now, bool dev, CancellationToken ct)
    {
        var state = await LoadStateAsync(user.Id, now, ct);
        var today = DateOnly.FromDateTime(now);
        if (state.Day == today && state.TaskJson != null)
        {
            return Read(state.TaskJson) with { Dev = dev };
        }

        var task = await ComposeAsync(user, state, now, ct);
        state.Day = today;
        state.TaskJson = Write(task);
        state.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return task with { Dev = dev };
    }

    /// <summary>
    /// Plays the task out: moves the forms on the ladder, counts dictionary answers, credits XP and
    /// the streak, decides whether "new" is offered. A repeated report of the same day changes nothing.
    /// Null when there is no task of that day.
    /// </summary>
    public async Task<DailySaved?> SaveResultAsync(User user, DailyReport report, DateTime now, bool dev, CancellationToken ct)
    {
        var state = await LoadStateAsync(user.Id, now, ct);
        if (state.TaskJson == null || state.Day?.ToString("yyyy-MM-dd") != report.Day)
        {
            return null;
        }

        var task = Read(state.TaskJson);
        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, user.Id, ct);
        if (task.Done)
        {
            return new DailySaved(task with { Dev = dev }, 0, progressCalculator.SerializeProgress(progress));
        }

        // A miss on the way back counts against the form wherever it came from: the warm-up or the pairs.
        var backWrong = report.BackWrong ?? [];
        var warmWrong = report.WarmWrong.Concat(backWrong).ToHashSet();
        var errors = Math.Max(report.Errors, report.PairWrong.Count);
        var pairWrong = report.PairWrong.Concat(backWrong).ToHashSet();

        await ApplyFormsAsync(user.Id, task, warmWrong, pairWrong, now, ct);
        await ApplyWordsAsync(user.Id, task, pairWrong, now, ct);

        progressCalculator.CreditPractice(progress, DailyTaskPlanner.XpReward);

        state.Accuracy = DailyTaskPlanner.NextAccuracy(state.Accuracy, errors);
        state.LastErrors = errors;
        state.MissedJson = JsonSerializer.Serialize(task.Pairs.Where(p => p.Kind == "verb" && pairWrong.Contains(p.Key)).Select(p => p.Key));
        state.DoneDay = state.Day;

        var offer = errors <= 1 && task.Mode != DailyMode.Review ? task.Next : null;
        task = task with
        {
            Done = true,
            Offer = offer,
            Result = new DailyResult(errors, DailyTaskPlanner.XpReward, progress.Streak)
        };
        state.TaskJson = Write(task);
        state.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);

        return new DailySaved(task with { Dev = dev }, DailyTaskPlanner.XpReward, progressCalculator.SerializeProgress(progress));
    }

    /// <summary>
    /// One more round after the task is done: the round being played, or a new one from what was practised
    /// longest ago. Null when today's task is not done yet or there is nothing left to build a round from.
    /// </summary>
    public async Task<DailyTaskDto?> ExtraAsync(User user, DateTime now, bool dev, CancellationToken ct)
    {
        var state = await LoadStateAsync(user.Id, now, ct);
        if (state.TaskJson == null || state.Day != DateOnly.FromDateTime(now))
        {
            return null;
        }

        var task = Read(state.TaskJson);
        if (!task.Done)
        {
            return null;
        }

        if (task.Extra != null)
        {
            return task.Extra with { Dev = dev };
        }

        var input = await InputAsync(user, state, now, ct);
        // The main task's forms that went wrong were not moved and still look "long unseen" — they wait for tomorrow.
        var skip = task.Pairs.Concat(task.Warm.Select(w => w.Item)).Select(i => i.Key).ToHashSet();
        var extra = DailyTaskPlanner.Extra(input with { Seed = input.Seed + task.Extras + 1 }, skip);
        if (extra == null)
        {
            return null;
        }

        state.TaskJson = Write(task with { Extra = extra });
        state.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return extra with { Dev = dev };
    }

    /// <summary>The extra round played out: forms and words move as in the task, XP is credited. Null when no round is being played.</summary>
    public async Task<DailySaved?> SaveExtraAsync(User user, DailyReport report, DateTime now, bool dev, CancellationToken ct)
    {
        var state = await LoadStateAsync(user.Id, now, ct);
        if (state.TaskJson == null || state.Day?.ToString("yyyy-MM-dd") != report.Day)
        {
            return null;
        }

        var task = Read(state.TaskJson);
        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, user.Id, ct);
        if (task.Extra is not { } extra)
        {
            return new DailySaved(task with { Dev = dev }, 0, progressCalculator.SerializeProgress(progress));
        }

        var backWrong = report.BackWrong ?? [];
        var pairWrong = report.PairWrong.Concat(backWrong).ToHashSet();
        await ApplyFormsAsync(user.Id, extra, [], pairWrong, now, ct);
        await ApplyWordsAsync(user.Id, extra, pairWrong, now, ct);
        progressCalculator.CreditPractice(progress, DailyTaskPlanner.XpExtra);
        state.Accuracy = DailyTaskPlanner.NextAccuracy(state.Accuracy, Math.Max(report.Errors, report.PairWrong.Count));

        var result = task.Result ?? new DailyResult(0, 0, progress.Streak);
        task = task with
        {
            Extra = null,
            Extras = task.Extras + 1,
            Result = result with { XpEarned = result.XpEarned + DailyTaskPlanner.XpExtra, Streak = progress.Streak }
        };
        state.TaskJson = Write(task);
        state.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return new DailySaved(task with { Dev = dev }, DailyTaskPlanner.XpExtra, progressCalculator.SerializeProgress(progress));
    }

    /// <summary>
    /// The offer was taken: fresh forms or a lesson were opened ("opened"), or the one-minute module check
    /// ended ("passed" / "failed"). Remembered so the next offer alternates and the check is not asked again.
    /// </summary>
    public async Task<DailyTaskDto?> ReportOfferAsync(User user, string day, string outcome, DateTime now, bool dev, CancellationToken ct)
    {
        var state = await LoadStateAsync(user.Id, now, ct);
        if (state.TaskJson == null || state.Day?.ToString("yyyy-MM-dd") != day)
        {
            return null;
        }

        var task = Read(state.TaskJson);
        if (task.Offer == null)
        {
            return task with { Dev = dev };
        }

        state.LastNew = task.Offer.Kind == DailyNew.Forms ? DailyNew.Forms : DailyNew.Lesson;
        if (task.Offer.Kind == DailyNew.Check && task.Offer.ModuleId != null && outcome is "passed" or "failed")
        {
            var course = ReadCourse(state.CourseJson);
            course[task.Offer.ModuleId] = outcome == "passed" ? CoursePlanner.Known : CoursePlanner.Lessons;
            state.CourseJson = JsonSerializer.Serialize(course);
        }

        task = task with { OfferTaken = true };
        state.TaskJson = Write(task);
        state.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return task with { Dev = dev };
    }

    /// <summary>
    /// Local stand only: moves everything the learner did <paramref name="days"/> days back, as if that
    /// much time passed — the next task is composed by the same rules as on a real next day.
    /// </summary>
    public async Task DevShiftAsync(Guid userId, int days, CancellationToken ct)
    {
        var shift = TimeSpan.FromDays(days);
        foreach (var f in await dbContext.VerbFormProgresses.Where(p => p.UserId == userId).ToListAsync(ct))
        {
            f.UpdatedAtUtc -= shift;
            f.CreatedAtUtc -= shift;
            f.NextDueAtUtc -= shift;
        }

        foreach (var w in await dbContext.VocabularyEntries.Where(e => e.UserId == userId).ToListAsync(ct))
        {
            w.UpdatedAtUtc -= shift;
            w.DateAddedUtc -= shift;
        }

        var progress = await dbContext.MiniAppUserProgresses.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (progress != null)
        {
            progress.LastPlayedAtUtc -= shift;
            var activity = JsonSerializer.Deserialize<List<DateTime>>(progress.ActivityDaysJson ?? "[]") ?? [];
            progress.ActivityDaysJson = JsonSerializer.Serialize(activity.Select(d => d - shift));
        }

        var state = await dbContext.DailyTaskStates.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (state != null)
        {
            state.Day = state.Day?.AddDays(-days);
            state.DoneDay = state.DoneDay?.AddDays(-days);
        }

        await dbContext.SaveChangesAsync(ct);
    }

    private async Task<DailyTaskDto> ComposeAsync(User user, DailyTaskState state, DateTime now, CancellationToken ct) =>
        DailyTaskPlanner.Compose(await InputAsync(user, state, now, ct));

    private async Task<DailyInput> InputAsync(User user, DailyTaskState state, DateTime now, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(now);
        var progress = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id, ct);
        var lastPlayed = progress?.LastPlayedAtUtc is { } at ? DateOnly.FromDateTime(at) : (DateOnly?)null;
        var away = lastPlayed == null ? 0 : Math.Max(0, today.DayNumber - lastPlayed.Value.DayNumber - 1);

        // A skipped day wipes the memory of the last game: its mistakes are no longer "yesterday's".
        var fresh = state.DoneDay != null && today.DayNumber - state.DoneDay.Value.DayNumber <= 1;

        var (forms, unopened) = await LoadFormsAsync(user.Id, ct);
        var words = await LoadWordsAsync(user.Id, ct);
        var completed = ReadCompleted(progress?.CompletedLessonsJson);

        return new DailyInput
        {
            Now = now,
            Away = away,
            Streak = progress?.Streak ?? 0,
            PlayedToday = lastPlayed == today,
            PlayedYesterday = lastPlayed == today.AddDays(-1),
            Accuracy = state.Accuracy,
            LastErrors = fresh ? state.LastErrors : 0,
            LastTaskYesterday = state.DoneDay == today.AddDays(-1),
            LastNew = state.LastNew,
            Missed = fresh ? JsonSerializer.Deserialize<List<string>>(state.MissedJson) ?? [] : [],
            Forms = forms,
            Unopened = unopened,
            Words = words,
            Course = CoursePlanner.Next(catalog.Modules(), completed, ReadCourse(state.CourseJson)),
            // Not HashCode.Combine: it is randomized per process, and the day's shuffle must not depend on a restart.
            Seed = user.Id.GetHashCode() ^ today.DayNumber
        };
    }

    /// <summary>Opened forms with their text and meaning, and what is still closed in the started verbs.</summary>
    private async Task<(List<DailyForm> Forms, List<DailyUnopened> Unopened)> LoadFormsAsync(Guid userId, CancellationToken ct)
    {
        var rows = await dbContext.VerbFormProgresses
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToListAsync(ct);
        var verbIds = rows.Select(r => r.VerbId).Distinct().ToList();
        var verbs = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => verbIds.Contains(v.Id))
            .Select(v => new { v.Id, v.Lemma, v.Translation, v.CardJson })
            .ToListAsync(ct);
        var meanings = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => verbIds.Contains(f.VerbId) && f.Meaning != null)
            .Select(f => new { f.VerbId, f.Tense, f.Person, f.Form, f.Meaning })
            .ToListAsync(ct);
        var levels = await dbContext.UserVerbs
            .AsNoTracking()
            .Where(v => v.UserId == userId && verbIds.Contains(v.VerbId))
            .ToDictionaryAsync(v => v.VerbId, v => v.Level, ct);

        string Meaning(Guid verbId, string tense, int person, string ka) =>
            meanings.FirstOrDefault(m => m.VerbId == verbId && m.Tense == tense && m.Person == person && m.Form == ka)?.Meaning
            ?? meanings.FirstOrDefault(m => m.VerbId == verbId && m.Tense == tense && m.Person == person)?.Meaning
            ?? $"{Persons[person]} · {DailyTaskPlanner.TenseName(tense)}";

        var forms = new List<DailyForm>();
        var unopened = new List<DailyUnopened>();
        foreach (var verb in verbs)
        {
            var cells = Cells(verb.CardJson);
            var verbRu = verb.Translation.Split(',')[0].Trim();
            var own = rows.Where(r => r.VerbId == verb.Id).ToDictionary(r => (r.Tense, r.Person));

            // The verb session opens new forms only while the verb is not near its exam and what was
            // started has settled (verbs/session/plan.ts: canMeet) — the offer must not promise more.
            var level = levels.GetValueOrDefault(verb.Id);
            var unsettled = own.Values.Count(r => r.Step is > 0 and < SettledStep);
            if (level < VerbLevel.ExamReady && unsettled <= MaxUnsettled)
            {
                var next = IntroOrder(cells.Where(c => !own.ContainsKey(c.Key)).Select(c => c.Key))
                    .Take(NewFormsPerSession)
                    .Select(c => new DailyFresh(c.Tense, c.Person, Meaning(verb.Id, c.Tense, c.Person, cells.First(x => x.Key == c).Value)))
                    .ToList();
                if (next.Count > 0)
                {
                    unopened.Add(new DailyUnopened(verb.Lemma, verbRu, next));
                }
            }

            foreach (var ((tense, person), ka) in cells)
            {
                if (!own.TryGetValue((tense, person), out var row))
                {
                    continue;
                }

                var ru = Meaning(verb.Id, tense, person, ka);
                forms.Add(new DailyForm(
                    verb.Lemma, verbRu, tense, person, ka, ru,
                    row.Step, row.BestStep, row.Reviews, row.NextDueAtUtc, row.UpdatedAtUtc));
            }
        }

        return (forms, unopened);
    }

    /// <summary>Dictionary entries that have a Georgian side.</summary>
    private async Task<List<DailyWord>> LoadWordsAsync(Guid userId, CancellationToken ct)
    {
        var entries = await dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .ToListAsync(ct);
        return entries
            .Select(e => (Entry: e, Sides: MiniAppHelpers.GetSides(e)))
            .Where(x => MiniAppHelpers.ContainsGeorgian(x.Sides.georgian) && !MiniAppHelpers.ContainsGeorgian(x.Sides.russian))
            .Select(x => new DailyWord(
                x.Entry.Id, x.Sides.georgian.Trim(), x.Sides.russian.Trim(),
                x.Entry.SuccessAnswersCount + x.Entry.SuccessAnswersCountInReverseDirection,
                x.Entry.FailedAnswersCount,
                x.Entry.DateAddedUtc,
                x.Entry.UpdatedAtUtc))
            .ToList();
    }

    private async Task ApplyFormsAsync(
        Guid userId, DailyTaskDto task, HashSet<string> warmWrong, HashSet<string> pairWrong, DateTime now, CancellationToken ct)
    {
        var played = task.Warm.Select(w => (w.Item, Warm: true, w.Due))
            .Concat(task.Pairs.Select(p => (Item: p, Warm: false, Due: false)))
            .Where(x => x.Item.Kind == "verb" && x.Item.Lemma != null)
            .ToList();
        foreach (var verb in played.GroupBy(x => x.Item.Lemma!))
        {
            var state = await verbProgress.GetAsync(userId, verb.Key, now, ct);
            if (state == null)
            {
                continue;
            }

            var steps = new List<VerbFormStep>();
            foreach (var (item, warm, due) in verb)
            {
                var row = state.Forms.FirstOrDefault(f => f.Tense == item.Tense && f.Person == item.Person);
                if (row == null)
                {
                    continue;
                }

                var mastered = row.Step == VerbFormProgress.MasteredStep;
                if (warm)
                {
                    // A due form answered wrong goes one step back into play; a long-unseen verb is only marked as practised.
                    steps.Add(!due ? new VerbFormStep(row.Tense, row.Person, row.Step, row.Reviews, now)
                        : warmWrong.Contains(item.Key) ? new VerbFormStep(row.Tense, row.Person, VerbFormProgress.MasteredStep - 1, row.Reviews, now)
                        : new VerbFormStep(row.Tense, row.Person, row.Step, row.Reviews + 1, now));
                }
                else if (!pairWrong.Contains(item.Key))
                {
                    steps.Add(mastered
                        ? new VerbFormStep(row.Tense, row.Person, row.Step, row.Reviews + 1, now)
                        : new VerbFormStep(row.Tense, row.Person, row.Step + 1, row.Step + 1 == VerbFormProgress.MasteredStep ? 0 : row.Reviews, now));
                }
            }

            await verbProgress.SaveAsync(userId, verb.Key, steps, now, ct);
        }
    }

    private async Task ApplyWordsAsync(Guid userId, DailyTaskDto task, HashSet<string> pairWrong, DateTime now, CancellationToken ct)
    {
        var ids = task.Pairs.Where(p => p.Kind == "word" && Guid.TryParse(p.Key[2..], out _))
            .ToDictionary(p => Guid.Parse(p.Key[2..]), p => p.Key);
        if (ids.Count == 0)
        {
            return;
        }

        var entries = await dbContext.VocabularyEntries
            .Where(e => e.UserId == userId && ids.Keys.Contains(e.Id))
            .ToListAsync(ct);
        foreach (var entry in entries)
        {
            if (pairWrong.Contains(ids[entry.Id]))
            {
                entry.FailedAnswersCount++;
            }
            else
            {
                entry.SuccessAnswersCount++;
            }

            entry.UpdatedAtUtc = now;
        }
    }

    private async Task<DailyTaskState> LoadStateAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var state = await dbContext.DailyTaskStates.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (state != null)
        {
            return state;
        }

        state = new DailyTaskState { Id = Guid.NewGuid(), UserId = userId, CreatedAtUtc = now, UpdatedAtUtc = now };
        dbContext.DailyTaskStates.Add(state);
        return state;
    }

    /// <summary>The ladder's cells of a verb with the form text, in the card's order — as the verb sessions teach them.</summary>
    private static List<KeyValuePair<(string Tense, int Person), string>> Cells(string cardJson)
    {
        var cells = new List<KeyValuePair<(string, int), string>>();
        var card = JsonNode.Parse(cardJson);
        if (card?["tenses"] is not JsonObject tenses)
        {
            return cells;
        }

        var unverified = VerbVerification.Of(card);
        foreach (var tense in LadderTenses.Where(t => !unverified.Contains(t)))
        {
            if (tenses[tense] is not JsonArray persons)
            {
                continue;
            }

            for (var person = 0; person < persons.Count; person++)
            {
                if (persons[person] is JsonArray { Count: > 0 } variants && variants[0]?.GetValue<string>() is { Length: > 0 } form)
                {
                    cells.Add(new((tense, person), form));
                }
            }
        }

        return cells;
    }

    private static Dictionary<string, IReadOnlyCollection<int>> ReadCompleted(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new();
        }

        var parsed = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json) ?? new();
        return parsed.ToDictionary(p => p.Key, p => (IReadOnlyCollection<int>)p.Value.ToHashSet());
    }

    private static Dictionary<string, string> ReadCourse(string json) =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new();

    private static DailyTaskDto Read(string json) => JsonSerializer.Deserialize<DailyTaskDto>(json, Json)!;

    private static string Write(DailyTaskDto task) => JsonSerializer.Serialize(task with { Dev = false }, Json);
}
