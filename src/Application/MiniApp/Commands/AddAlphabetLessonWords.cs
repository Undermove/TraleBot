using System.Text.Json;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Commands;

/// <summary>
/// After a counted alphabet words lesson (id 12+) its Georgian words go into the learner's dictionary, the same
/// entries a translated word makes — but straight from the lesson's own list (<see cref="IAlphabetLessonWords"/>):
/// no translator, no subscription check, nothing counted against any limit. Words of other counted words
/// lessons the learner does not have yet are added too. A letters lesson (1..11) teaches no words: it answers
/// with an empty list. A word the learner already has (same word, Georgian) is left as is, so calling it again
/// changes nothing. A lesson that is not counted adds nothing.
/// </summary>
public class AddAlphabetLessonWords : IRequest<AddAlphabetLessonWordsResult>
{
    public const string ModuleId = "alphabet-progressive";

    public required Guid UserId { get; init; }
    public required int LessonId { get; init; }

    public class Handler(ITraleDbContext context, IAlphabetLessonWords lessonWords, IAchievementsService achievements)
        : IRequestHandler<AddAlphabetLessonWords, AddAlphabetLessonWordsResult>
    {
        public async Task<AddAlphabetLessonWordsResult> Handle(AddAlphabetLessonWords request, CancellationToken ct)
        {
            var own = lessonWords.WordsOf(request.LessonId);
            var letters = request.LessonId is >= 1 and <= LearningConstants.Modules.AlphabetLetterLessons;
            if (own.Count == 0 && !letters)
            {
                return new AddAlphabetLessonWordsResult.UnknownLesson();
            }

            return await LessonWordsToDictionary.AddAsync(context, achievements, request.UserId, ModuleId, lessonWords, request.LessonId, ct);
        }
    }
}

/// <summary>
/// After a counted «Знакомство» lesson its phrases and scene words go into the learner's dictionary — the same way
/// as the alphabet words (<see cref="AddAlphabetLessonWords"/>): from the server's own list, no translator, no
/// limits; words already there are left as is, earlier counted lessons' words are added too.
/// </summary>
public class AddIntroLessonWords : IRequest<AddAlphabetLessonWordsResult>
{
    public const string ModuleId = "intro";

    public required Guid UserId { get; init; }
    public required int LessonId { get; init; }

    public class Handler(ITraleDbContext context, IIntroLessonWords lessonWords, IAchievementsService achievements)
        : IRequestHandler<AddIntroLessonWords, AddAlphabetLessonWordsResult>
    {
        public Task<AddAlphabetLessonWordsResult> Handle(AddIntroLessonWords request, CancellationToken ct) =>
            lessonWords.WordsOf(request.LessonId).Count == 0
                ? Task.FromResult<AddAlphabetLessonWordsResult>(new AddAlphabetLessonWordsResult.UnknownLesson())
                : LessonWordsToDictionary.AddAsync(context, achievements, request.UserId, ModuleId, lessonWords, request.LessonId, ct);
    }
}

/// <summary>Puts a counted lesson's words (and those of the module's other counted lessons) into the dictionary.</summary>
internal static class LessonWordsToDictionary
{
    public static async Task<AddAlphabetLessonWordsResult> AddAsync(ITraleDbContext context, IAchievementsService achievements,
        Guid userId, string moduleId, IAlphabetLessonWords lessonWords, int lessonId, CancellationToken ct)
    {
        var own = lessonWords.WordsOf(lessonId);
        var progress = await context.MiniAppUserProgresses.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var counted = CompletedLessons(progress?.CompletedLessonsJson, moduleId);
        if (!counted.Contains(lessonId))
        {
            return new AddAlphabetLessonWordsResult.LessonNotCompleted();
        }

        // Слова всех засчитанных уроков слов (этот — тоже), которых у человека ещё нет.
        var wanted = lessonWords.WordLessons
            .Where(l => counted.Contains(l.Id))
            .SelectMany(l => l.Words)
            .DistinctBy(w => w.Word)
            .ToList();
        var keys = wanted.Select(w => w.Word.Trim().ToLowerInvariant()).ToList();
        var existing = (await context.VocabularyEntries
                .Where(e => e.UserId == userId && e.Language == Language.Georgian && keys.Contains(e.Word))
                .Select(e => e.Word)
                .ToListAsync(ct))
            .ToHashSet();

        var now = DateTime.UtcNow;
        var added = new HashSet<string>();
        foreach (var w in wanted)
        {
            var word = w.Word.Trim().ToLowerInvariant();
            if (existing.Contains(word) || !added.Add(word))
            {
                continue;
            }

            await context.VocabularyEntries.AddAsync(new VocabularyEntry
            {
                Id = Guid.NewGuid(),
                Word = word,
                Definition = w.Translation.Trim().ToLowerInvariant(),
                AdditionalInfo = "",
                Example = "",
                UserId = userId,
                DateAddedUtc = now,
                UpdatedAtUtc = now,
                Language = Language.Georgian
            }, ct);
        }

        if (added.Count > 0)
        {
            await context.SaveChangesAsync(ct);
            // The same achievements a translated word can open (10, 100, 1000 words in the dictionary).
            var total = await context.VocabularyEntries.CountAsync(e => e.UserId == userId, ct);
            await achievements.AssignAchievements(new VocabularyCountTrigger { VocabularyEntriesCount = total }, userId, ct);
        }

        return new AddAlphabetLessonWordsResult.Success(
            own.Select(w => new AddedAlphabetWord(w.Word, w.Translation, added.Contains(w.Word.Trim().ToLowerInvariant()))).ToList(),
            added.Count);
    }

    private static HashSet<int> CompletedLessons(string? json, string moduleId)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            var all = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json);
            return all != null && all.TryGetValue(moduleId, out var lessons) ? lessons.ToHashSet() : [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}

/// <summary>A word of the lesson and whether this call put it into the dictionary (false — it was already there).</summary>
public record AddedAlphabetWord(string Word, string Translation, bool Added);

public abstract record AddAlphabetLessonWordsResult
{
    /// <param name="Words">The words of the lesson itself, in lesson order.</param>
    /// <param name="AddedCount">How many entries this call added, earlier lessons included.</param>
    public record Success(IReadOnlyList<AddedAlphabetWord> Words, int AddedCount) : AddAlphabetLessonWordsResult;
    public record LessonNotCompleted : AddAlphabetLessonWordsResult;
    public record UnknownLesson : AddAlphabetLessonWordsResult;
}
