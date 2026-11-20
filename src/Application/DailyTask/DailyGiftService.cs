using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.DailyTask;

/// <summary>One box of the day as the mini-app sees it. Rarity 0..3: обычный, редкий, эпический, легендарный.</summary>
/// <param name="Box">0 — for the task of the day, 1 — for one more round after it.</param>
/// <param name="Ready">It can be opened now (what it is for is done).</param>
/// <param name="Prize">churchkhela · freeze · boost · friend (invite a friend by the referral link) · days (free days for oneself).</param>
/// <param name="Days">Free days given — for <c>days</c>.</param>
public record DailyGiftBox(int Box, bool Ready, bool Opened, int? Rarity, string? Prize, int? Days);

/// <param name="Streak">The streak the gift is counted for: today included once the day is played, otherwise what it becomes after today.</param>
/// <param name="Odds">Chances of the four rarities for that streak.</param>
/// <param name="GuaranteedIn">Days until the next guaranteed epic or better (0 — today).</param>
/// <param name="Freezes">Streak freezes in stock.</param>
/// <param name="BoostToday">Today the task gives double XP.</param>
public record DailyGiftDto(
    string Day, int Streak, IReadOnlyList<double> Odds, int GuaranteedIn,
    IReadOnlyList<DailyGiftBox> Boxes, int Freezes, bool BoostToday, DateTime BurnsAtUtc);

/// <summary>
/// The gift of the day: a box at the end of the task (and a second one for one more round) with a prize of
/// one of four rarities. Nobody loses — something always drops; a longer streak shifts the odds to the rare
/// ones and every 7th day of the streak gives epic or better. Prizes: churchkhela for Bombora, a streak freeze,
/// double XP tomorrow or «invite a friend» (the usual referral — both get days, with its own anti-fraud caps),
/// and free days for oneself. Free days are the "wow" that cannot be farmed: the very first box gives +3 for
/// sure, later +1 drops at most once in <see cref="DaysCooldown"/> — until then the top box gives an invite.
/// The draw happens on the server and is kept, so reopening the app cannot reroll it.
/// Service per ARCHITECTURE.md.
/// </summary>
public class DailyGiftService(ITraleDbContext dbContext)
{
    /// <summary>Free days from the very first box — the strong first impression.</summary>
    public const int FirstDays = 3;

    /// <summary>Free days later on.</summary>
    public const int Days = 1;

    /// <summary>Free days drop no more often than this.</summary>
    public static readonly TimeSpan DaysCooldown = TimeSpan.FromDays(30);

    public const int MaxFreezes = 5;

    /// <summary>The treat Bombora gets (TreatShop index 3 — чурчхела).</summary>
    public const int ChurchkhelaIndex = 3;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private record Opened(int Box, int Rarity, string Prize, int? Days);

    private record Stored(string Day, List<Opened> Boxes);

    /// <summary>The chances of обычный / редкий / эпический / легендарный on the <paramref name="streak"/>-th day.</summary>
    public static double[] Odds(int streak)
    {
        var d = Math.Max(1, streak);
        if (d % 7 == 0) return [0, 0, 0.8, 0.2];
        var k = Math.Min(d, 30) / 30.0;
        return [0.60 - 0.35 * k, 0.28 + 0.12 * k, 0.10 + 0.15 * k, 0.02 + 0.08 * k];
    }

    public static int Roll(double[] odds, double r)
    {
        for (var i = 0; i < odds.Length; i++)
        {
            if ((r -= odds[i]) <= 0) return i;
        }

        return 0;
    }

    public async Task<DailyGiftDto> GetAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var state = await dbContext.DailyTaskStates.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        var progress = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return View(state, progress, now);
    }

    /// <summary>
    /// Opens box <paramref name="box"/> of today: draws the rarity, gives the prize, remembers it. Opening an
    /// opened box returns it as it was. Null when the box is not ready (its task is not done).
    /// </summary>
    public async Task<(DailyGiftDto Gift, DailyGiftBox Box)?> OpenAsync(Guid userId, int box, DateTime now, CancellationToken ct, Func<double>? random = null)
    {
        var state = await dbContext.DailyTaskStates.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, userId, ct);
        var view = View(state, progress, now);
        var current = view.Boxes.FirstOrDefault(b => b.Box == box);
        if (state == null || current == null || !current.Ready) return null;
        if (current.Opened) return (view, current);

        var rnd = random ?? Random.Shared.NextDouble;
        var today = DateOnly.FromDateTime(now);
        var user = await dbContext.Users.FirstAsync(u => u.Id == userId, ct);
        var (rarity, prize, days) = Draw(progress, user, view.Streak, now, rnd);
        switch (prize)
        {
            case "churchkhela":
                progress.TotalTreatsGiven += 1;
                progress.LastFedAtUtc = now;
                progress.LastTreatIndex = ChurchkhelaIndex;
                break;
            case "freeze":
                progress.StreakFreezes = Math.Min(MaxFreezes, progress.StreakFreezes + 1);
                break;
            case "boost":
                // Tomorrow; if tomorrow is already doubled, the day after.
                var tomorrow = today.AddDays(1);
                progress.XpBoostDay = progress.XpBoostDay is { } b && b >= tomorrow ? b.AddDays(1) : tomorrow;
                break;
            case "days":
                user.ExtendAccessDays(days!.Value, now);
                progress.GiftDaysAtUtc = now;
                break;
        }

        var stored = Read(state.GiftJson, today);
        stored.Boxes.Add(new Opened(box, rarity, prize, days));
        state.GiftJson = JsonSerializer.Serialize(stored, Json);
        state.UpdatedAtUtc = now;
        progress.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);

        view = View(state, progress, now);
        return (view, view.Boxes.First(b => b.Box == box));
    }

    /// <summary>Local stand only: today's boxes are closed again.</summary>
    public async Task DevResetAsync(Guid userId, CancellationToken ct)
    {
        var state = await dbContext.DailyTaskStates.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (state == null) return;
        state.GiftJson = null;
        await dbContext.SaveChangesAsync(ct);
    }

    private static DailyGiftDto View(DailyTaskState? state, MiniAppUserProgress? progress, DateTime now)
    {
        var today = DateOnly.FromDateTime(now);
        var streak = StreakOfToday(progress, today);
        var task = state?.Day == today && state.TaskJson != null
            ? JsonSerializer.Deserialize<DailyTaskDto>(state.TaskJson, Json)
            : null;
        var stored = Read(state?.GiftJson, today);
        var ready = new[] { task?.Done == true, (task?.Extras ?? 0) > 0 };
        var boxes = ready.Select((r, i) =>
        {
            var o = stored.Boxes.FirstOrDefault(b => b.Box == i);
            return new DailyGiftBox(i, r, o != null, o?.Rarity, o?.Prize, o?.Days);
        }).ToList();

        return new DailyGiftDto(
            today.ToString("yyyy-MM-dd"), streak, Odds(streak), (7 - streak % 7) % 7, boxes,
            progress?.StreakFreezes ?? 0, progress?.XpBoostDay == today,
            today.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
    }

    /// <summary>
    /// The streak today counts as: as it stands once today is played; +1 if yesterday was played (or the gap is
    /// covered by freezes); 1 if it breaks.
    /// </summary>
    public static int StreakOfToday(MiniAppUserProgress? progress, DateOnly today)
    {
        if (progress?.LastPlayedAtUtc is not { } at) return 1;
        var last = DateOnly.FromDateTime(at);
        if (last == today) return Math.Max(1, progress.Streak);
        var missed = today.DayNumber - last.DayNumber - 1;
        return missed <= progress.StreakFreezes ? progress.Streak + 1 : 1;
    }

    private static Stored Read(string? json, DateOnly today)
    {
        var day = today.ToString("yyyy-MM-dd");
        if (json == null) return new Stored(day, []);
        try
        {
            var stored = JsonSerializer.Deserialize<Stored>(json, Json);
            return stored != null && stored.Day == day ? stored with { Boxes = stored.Boxes ?? [] } : new Stored(day, []);
        }
        catch (JsonException)
        {
            return new Stored(day, []);
        }
    }

    /// <summary>
    /// What drops. The very first box ever: the golden one with +3 free days. Later the golden one gives +1 day,
    /// but only once in <see cref="DaysCooldown"/>; within it, and for Lifetime (nothing to add to), the top roll
    /// becomes «invite a friend». Epic is half double XP, half «invite a friend».
    /// </summary>
    public static (int Rarity, string Prize, int? Days) Draw(MiniAppUserProgress progress, User user, int streak, DateTime now, Func<double> rnd)
    {
        var canGiveDays = !user.IsLifetime;
        if (progress.GiftDaysAtUtc == null && canGiveDays) return (3, "days", FirstDays);

        var rarity = Roll(Odds(streak), rnd());
        if (rarity == 3 && canGiveDays && now - progress.GiftDaysAtUtc >= DaysCooldown) return (3, "days", Days);
        return rarity switch
        {
            0 => (0, "churchkhela", null),
            1 => (1, "freeze", null),
            3 => (3, "friend", null),
            _ => (2, rnd() < 0.5 ? "boost" : "friend", null)
        };
    }
}
