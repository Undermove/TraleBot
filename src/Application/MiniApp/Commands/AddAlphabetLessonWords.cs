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
/// After a counted alphabet lesson its Georgian words go into the learner's dictionary, the same entries
/// a translated word makes — but straight from the lesson's own list (<see cref="IAlphabetLessonWords"/>):
/// no translator, no subscription check, nothing counted against any limit. Words of earlier counted
/// alphabet lessons the learner does not have yet are added too, so the dictionary matches «ты знаешь уже
/// N слов» of the lesson's celebration. A word the learner already has (same word, Georgian) is left as is,
/// so calling it again changes nothing. A lesson that is not counted adds nothing.
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
            if (own.Count == 0)
            {
                return new AddAlphabetLessonWordsResult.UnknownLesson();
            }

            var progress = await context.MiniAppUserProgresses.AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == request.UserId, ct);
            var counted = CompletedAlphabetLessons(progress?.CompletedLessonsJson);
            if (!counted.Contains(request.LessonId))
            {
                return new AddAlphabetLessonWordsResult.LessonNotCompleted();
            }

            var wanted = counted.Where(l => l <= request.LessonId)
                .SelectMany(lessonWords.WordsOf)
                .DistinctBy(w => w.Word)
                .ToList();
            var keys = wanted.Select(w => w.Word.Trim().ToLowerInvariant()).ToList();
            var existing = (await context.VocabularyEntries
                    .Where(e => e.UserId == request.UserId && e.Language == Language.Georgian && keys.Contains(e.Word))
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
                    UserId = request.UserId,
                    DateAddedUtc = now,
                    UpdatedAtUtc = now,
                    Language = Language.Georgian
                }, ct);
            }

            if (added.Count > 0)
            {
                await context.SaveChangesAsync(ct);
                // The same achievements a translated word can open (10, 100, 1000 words in the dictionary).
                var total = await context.VocabularyEntries.CountAsync(e => e.UserId == request.UserId, ct);
                await achievements.AssignAchievements(new VocabularyCountTrigger { VocabularyEntriesCount = total }, request.UserId, ct);
            }

            return new AddAlphabetLessonWordsResult.Success(
                own.Select(w => new AddedAlphabetWord(w.Word, w.Translation, added.Contains(w.Word.Trim().ToLowerInvariant()))).ToList(),
                added.Count);
        }

        private static HashSet<int> CompletedAlphabetLessons(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return [];
            }

            try
            {
                var all = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json);
                return all != null && all.TryGetValue(ModuleId, out var lessons) ? lessons.ToHashSet() : [];
            }
            catch (JsonException)
            {
                return [];
            }
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
