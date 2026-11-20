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
public class DailyGiftService(ITraleDbContext dbContext, ITreasureCatalog treasures)
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
        var stash = GiftStash.Read(progress.GiftStashJson);
        var (rarity, prize, days) = Draw(progress, user, stash, view.Streak, now, rnd,
            treasures.Words.Select(w => w.Id).ToArray(), treasures.Cards.Select(c => c.Id).ToArray());
        var (kind, id) = prize.Split(':') is [var k, var v] ? (k, v) : (prize, "");
        switch (kind)
        {
            case "hint":
                stash.Hints += 1;
                break;
            case "card":
                stash.Cards.Add(id);
                break;
            case "word":
                stash.Words.Add(id);
                await AddToDictionaryAsync(userId, treasures.Words.First(w => w.Id == id), now, ct);
                break;
            case "furn":
                stash.Furniture.Add(id);
                break;
            case "item":
                stash.Items.Add(id);
                // A new thing goes on at once if its slot is free.
                var slot = GiftCatalog.Items.First(i => i.Id == id).Slot;
                stash.Wear.TryAdd(slot, id);
                break;
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

        progress.GiftStashJson = stash.Write();
        var stored = Read(state.GiftJson, today);
        stored.Boxes.Add(new Opened(box, rarity, prize, days));
        state.GiftJson = JsonSerializer.Serialize(stored, Json);
        state.UpdatedAtUtc = now;
        progress.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);

        view = View(state, progress, now);
        return (view, view.Boxes.First(b => b.Box == box));
    }

    /// <summary>A treasure word goes into the learner's dictionary — repetition picks it up like any other word.</summary>
    private async Task AddToDictionaryAsync(Guid userId, TreasureWord word, DateTime now, CancellationToken ct)
    {
        var ka = word.Ka.Trim().ToLowerInvariant();
        if (await dbContext.VocabularyEntries.AnyAsync(e => e.UserId == userId && e.Word == ka, ct)) return;
        dbContext.VocabularyEntries.Add(new VocabularyEntry
        {
            Id = Guid.NewGuid(), Word = ka, Definition = word.Ru.Trim().ToLowerInvariant(), AdditionalInfo = word.Story,
            Example = "", UserId = userId, DateAddedUtc = now, UpdatedAtUtc = now, Language = Language.Georgian
        });
    }

    /// <summary>What the learner has collected.</summary>
    public async Task<GiftStash> StashAsync(Guid userId, CancellationToken ct)
    {
        var progress = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return GiftStash.Read(progress?.GiftStashJson);
    }

    /// <summary>Spends a hint in an exercise. False — none left.</summary>
    public async Task<(bool Ok, int Left)> UseHintAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, userId, ct);
        var stash = GiftStash.Read(progress.GiftStashJson);
        if (stash.Hints <= 0) return (false, 0);
        stash.Hints -= 1;
        progress.GiftStashJson = stash.Write();
        progress.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return (true, stash.Hints);
    }

    /// <summary>Puts on a thing (or takes the slot off with <paramref name="itemId"/> null). Only owned things.</summary>
    public async Task<GiftStash?> WearAsync(Guid userId, string slot, string? itemId, DateTime now, CancellationToken ct)
    {
        if (!GiftCatalog.Slots.Contains(slot)) return null;
        var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, userId, ct);
        var stash = GiftStash.Read(progress.GiftStashJson);
        if (itemId == null) stash.Wear.Remove(slot);
        else if (stash.Items.Contains(itemId) && GiftCatalog.Items.Any(i => i.Id == itemId && i.Slot == slot)) stash.Wear[slot] = itemId;
        else return null;
        progress.GiftStashJson = stash.Write();
        progress.UpdatedAtUtc = now;
        await dbContext.SaveChangesAsync(ct);
        return stash;
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
    /// What drops. The very first box ever: the golden one with +3 free days. After that each box has a few
    /// kinds of prize, one picked at random; collections (words, postcards, furniture, things) give what the
    /// learner does not have yet, and once complete fall back to the box's simple prize:
    ///  · gift box — churchkhela · a hint · a postcard;
    ///  · wooden chest — a streak freeze · a treasure word · furniture for Bombora's house;
    ///  · enamel chest — double XP tomorrow · «invite a friend» · a thing for Bombora;
    ///  · golden chest — +1 free day (at most once in <see cref="DaysCooldown"/>, never for Lifetime),
    ///    otherwise a golden thing for Bombora, otherwise «invite a friend».
    /// </summary>
    public static (int Rarity, string Prize, int? Days) Draw(
        MiniAppUserProgress progress, User user, GiftStash stash, int streak, DateTime now, Func<double> rnd,
        IReadOnlyCollection<string>? words = null, IReadOnlyCollection<string>? cards = null)
    {
        var canGiveDays = !user.IsLifetime;
        if (progress.GiftDaysAtUtc == null && canGiveDays) return (3, "days", FirstDays);

        var rarity = Roll(Odds(streak), rnd());
        string? Pick(IEnumerable<string> pool, IEnumerable<string> owned, string prefix)
        {
            var left = pool.Except(owned).ToArray();
            return left.Length == 0 ? null : prefix + left[(int)(rnd() * left.Length) % left.Length];
        }
        var kind = (int)(rnd() * 3) % 3;
        switch (rarity)
        {
            case 0:
                return (0, kind switch
                {
                    0 => "churchkhela",
                    1 => "hint",
                    _ => Pick(cards ?? [], stash.Cards, "card:") ?? "hint"
                }, null);
            case 1:
                return (1, kind switch
                {
                    0 => "freeze",
                    1 => Pick(words ?? [], stash.Words, "word:") ?? "freeze",
                    _ => Pick(GiftCatalog.Furniture, stash.Furniture, "furn:") ?? "freeze"
                }, null);
            case 2:
                return (2, kind switch
                {
                    0 => "boost",
                    1 => "friend",
                    _ => Pick(GiftCatalog.Items.Where(i => !i.Golden).Select(i => i.Id), stash.Items, "item:") ?? "boost"
                }, null);
            default:
                if (canGiveDays && now - progress.GiftDaysAtUtc >= DaysCooldown) return (3, "days", Days);
                return (3, Pick(GiftCatalog.Items.Where(i => i.Golden).Select(i => i.Id), stash.Items, "item:") ?? "friend", null);
        }
    }
}
