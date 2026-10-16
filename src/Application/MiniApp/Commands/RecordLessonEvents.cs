using System.Text.RegularExpressions;
using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Commands;

/// <summary>
/// A batch of lesson-flow events from the mini-app (opened, step started / done / skipped, lesson counted,
/// failed, left) — to see where people drop off inside a lesson. Only known step kinds and events within sane
/// ranges are kept, the rest is dropped silently (an old or a tampered client must not fail a lesson). At most
/// <see cref="MaxBatch"/> events per request and <see cref="MaxPerUserPerDay"/> per learner per day; past the cap
/// events are dropped. Never answers with an error: analytics must not get in the way of learning.
/// </summary>
public partial class RecordLessonEvents : IRequest<int>
{
    public const int MaxBatch = 50;
    public const int MaxPerUserPerDay = 3000;

    public static readonly IReadOnlySet<string> StepKinds = new HashSet<string>
    {
        "opener", "letter-intro", "how-to-write", "catch", "sound-letter", "pairs", "new-word", "morph",
        "assemble", "dialogue", "cafe", "check", "finale", "lesson",
        // Знакомство с приложением (ModuleId "onboarding").
        "greeting", "first-word", "tour", "celebration",
        // «Знакомство» (ModuleId "intro").
        "new-phrase", "rule", "yard", "walk", "bakery", "pingpong", "elevator", "party", "magnets", "border", "reception", "detective", "chat", "taxi",
        "family", "havesort", "aboutme", "supra"
    };

    public static readonly IReadOnlySet<string> Events = new HashSet<string>
    {
        "lesson_open", "step_start", "step_done", "step_skip", "lesson_complete", "lesson_fail", "lesson_exit"
    };

    public required Guid UserId { get; init; }
    public required IReadOnlyList<LessonEventInput> Items { get; init; }

    [GeneratedRegex("^[a-z0-9-]{1,64}$")]
    private static partial Regex ModulePattern();

    public static bool IsValid(LessonEventInput e) =>
        e.ModuleId != null && ModulePattern().IsMatch(e.ModuleId)
        && e.LessonId is >= 1 and <= 1000
        && e.Step is >= 0 and <= 200
        && e.StepKind != null && StepKinds.Contains(e.StepKind)
        && e.Event != null && Events.Contains(e.Event)
        && e.Value is null or (>= 0 and <= 100_000);

    public class Handler(ITraleDbContext context) : IRequestHandler<RecordLessonEvents, int>
    {
        public async Task<int> Handle(RecordLessonEvents request, CancellationToken ct)
        {
            var valid = request.Items.Take(MaxBatch).Where(IsValid).ToList();
            if (valid.Count == 0)
            {
                return 0;
            }

            var now = DateTime.UtcNow;
            var since = now.AddDays(-1);
            var today = await context.LessonEvents.CountAsync(e => e.UserId == request.UserId && e.CreatedAtUtc >= since, ct);
            var room = MaxPerUserPerDay - today;
            if (room <= 0)
            {
                return 0;
            }

            // Время — серверное, порядок внутри пачки сохраняем микросекундным сдвигом.
            var kept = valid.Take(room).Select((e, i) => new LessonEvent
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                ModuleId = e.ModuleId!,
                LessonId = e.LessonId,
                Step = e.Step,
                StepKind = e.StepKind!,
                Event = e.Event!,
                Value = e.Value,
                CreatedAtUtc = now.AddTicks(i * 10)
            }).ToList();
            context.LessonEvents.AddRange(kept);
            await context.SaveChangesAsync(ct);
            return kept.Count;
        }
    }
}

/// <summary>One event as the mini-app sends it.</summary>
public record LessonEventInput(string? ModuleId, int LessonId, int Step, string? StepKind, string? Event, int? Value);
