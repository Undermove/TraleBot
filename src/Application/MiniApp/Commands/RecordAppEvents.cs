using System.Text.RegularExpressions;
using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Commands;

/// <summary>
/// A batch of mini-app events outside lessons (opened, loaded, failed to load, screen shown, paywall opened,
/// hidden) — to see who left before the app loaded and where people go once it did. Only known events with
/// sane fields are kept, the rest is dropped silently; a field that does not fit (an odd platform, a start
/// parameter with spaces) is dropped, not the event. At most <see cref="MaxBatch"/> events per request and
/// <see cref="MaxPerUserPerDay"/> per person per day. Never answers with an error: analytics must not get in the
/// way. Lesson steps go to <see cref="RecordLessonEvents"/>.
/// </summary>
public partial class RecordAppEvents : IRequest<int>
{
    public const int MaxBatch = 50;
    public const int MaxPerUserPerDay = 1000;

    public static readonly IReadOnlySet<string> Events = new HashSet<string>
    {
        "app_open", "app_ready", "app_error", "app_hide", "screen", "paywall"
    };

    public required Guid UserId { get; init; }
    public required IReadOnlyList<AppEventInput> Items { get; init; }

    [GeneratedRegex("^[a-z0-9_-]{1,32}$")]
    private static partial Regex TargetPattern();

    [GeneratedRegex("^[a-z0-9_]{1,16}$")]
    private static partial Regex PlatformPattern();

    public static bool IsValid(AppEventInput e) =>
        e.Event != null && Events.Contains(e.Event)
        && (e.Target == null || TargetPattern().IsMatch(e.Target))
        && e.Value is null or (>= 0 and <= 10_000_000);

    public class Handler(ITraleDbContext context) : IRequestHandler<RecordAppEvents, int>
    {
        public async Task<int> Handle(RecordAppEvents request, CancellationToken ct)
        {
            var valid = request.Items.Take(MaxBatch).Where(IsValid).ToList();
            if (valid.Count == 0)
            {
                return 0;
            }

            var now = DateTime.UtcNow;
            var since = now.AddDays(-1);
            var today = await context.AppEvents.CountAsync(e => e.UserId == request.UserId && e.CreatedAtUtc >= since, ct);
            var room = MaxPerUserPerDay - today;
            if (room <= 0)
            {
                return 0;
            }

            // Время — серверное, порядок внутри пачки сохраняем микросекундным сдвигом.
            var kept = valid.Take(room).Select((e, i) => new AppEvent
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Event = e.Event!,
                Target = e.Target,
                Value = e.Value,
                Platform = e.Platform != null && PlatformPattern().IsMatch(e.Platform) ? e.Platform : null,
                StartParam = RecordAcquisitionSourceService.Sanitize(e.StartParam),
                CreatedAtUtc = now.AddTicks(i * 10)
            }).ToList();
            context.AppEvents.AddRange(kept);
            await context.SaveChangesAsync(ct);
            return kept.Count;
        }
    }
}

/// <summary>One event as the mini-app sends it.</summary>
public record AppEventInput(string? Event, string? Target, int? Value, string? Platform, string? StartParam);
