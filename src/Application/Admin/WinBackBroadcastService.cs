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

        var userIds = candidates.Select(c => c.UserId).ToHashSet();
        var users = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync(ct);

        var sent = 0;
        var failed = 0;

        foreach (var user in users)
        {
            var ok = await sender.SendTextAsync(user.TelegramId, MessageText, includeMiniAppButton: true, ct);
            if (ok)
            {
                user.SetWinBackSent(DateTime.UtcNow);
                sent++;
            }
            else
            {
                failed++;
            }
        }

        if (sent > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return new WinBackResult(Sent: sent, Skipped: 0, Failed: failed);
    }
}
