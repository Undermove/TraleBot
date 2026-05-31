using Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

public record WinBackResult(int Sent, int Skipped, int Failed);

public class WinBackBroadcastService(
    WinBackTargetingService targeting,
    ITelegramMessageSender sender,
    ITraleDbContext db)
{
    // Cohort parameters for the May 13, 2026 campaign — hardcoded by design.
    private static readonly DateTime CohortAfter = new(2026, 5, 13, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime CohortBefore = new(2026, 5, 14, 0, 0, 0, DateTimeKind.Utc);
    private const int InactiveSinceDays = 7;

    internal const string MessageText =
        "მოგვენატრე — «нам тебя не хватало» 🍊\n\nПока тебя не было, мы обновили уроки грузинского. Загляни — всего 5 минут, и ты уже вспомнишь алфавит.";

    public async Task<WinBackResult> ExecuteAsync(bool dryRun, CancellationToken ct)
    {
        var candidates = await targeting.GetEligibleUsersAsync(CohortAfter, CohortBefore, InactiveSinceDays, ct);

        if (dryRun)
        {
            return new WinBackResult(Sent: candidates.Count, Skipped: 0, Failed: 0);
        }

        var sent = 0;
        var failed = 0;
        var sentUserIds = new List<Guid>();

        foreach (var candidate in candidates)
        {
            var ok = await sender.SendTextAsync(candidate.TelegramId, MessageText, includeMiniAppButton: true, ct);
            if (ok)
            {
                sentUserIds.Add(candidate.UserId);
                sent++;
            }
            else
            {
                failed++;
            }
        }

        if (sentUserIds.Count > 0)
        {
            var now = DateTime.UtcNow;
            var sentUsers = await db.Users
                .Where(u => sentUserIds.Contains(u.Id))
                .ToListAsync(ct);
            foreach (var user in sentUsers)
                user.SetWinBackSent(now);
            await db.SaveChangesAsync(ct);
        }

        return new WinBackResult(Sent: sent, Skipped: 0, Failed: failed);
    }
}
