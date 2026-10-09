using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Feedback;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// The first screen of the admin: a few numbers that say how things are, and how much in each
/// section waits for the owner. Only what the database really knows — "studied" is the dated
/// trace of <see cref="UserActivity"/>, not "opened the mini-app".
/// </summary>
public class GetAdminOverviewQuery(ITraleDbContext db, FeedbackReplyService replies)
{
    public async Task<AdminOverviewDto> ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var lastActive = await UserActivity.LoadLastAsync(db, ct);
        var payments = await db.Payments.AsNoTracking()
            .Where(p => p.RefundedAtUtc == null && p.PurchasedAtUtc >= now.AddDays(-30))
            .Select(p => p.Amount).ToListAsync(ct);

        // Sent to people (not a trial to oneself) and not sent to everyone picked.
        var unfinished = await db.BroadcastCampaigns.AsNoTracking()
            .Where(c => c.Audience != BroadcastAudience.Owner
                        && db.BroadcastDeliveries.Any(d => d.CampaignId == c.Id && d.Status == BroadcastDeliveryStatus.Pending))
            .Select(c => c.SurveyJson != null).ToListAsync(ct);

        return new AdminOverviewDto
        {
            TotalUsers = users.Count,
            NewUsers7d = users.Count(u => u.RegisteredAtUtc >= now.AddDays(-7)),
            StudiedToday = lastActive.Values.Count(at => at >= now.AddDays(-1)),
            Studied7d = lastActive.Values.Count(at => at >= now.AddDays(-7)),
            Payments30d = payments.Count,
            Stars30d = payments.Sum(a => (long)a),
            ActiveSubscriptions = users.Count(u => u.HasActivePro(now)),
            OnTrial = users.Count(u => u.HasActiveTrial(now)),
            UnansweredMessages = await replies.CountUnansweredAsync(ct),
            UnfinishedSurveys = unfinished.Count(isSurvey => isSurvey),
            UnfinishedBroadcasts = unfinished.Count(isSurvey => !isSurvey),
            VerbsToReview = await db.Verbs.CountAsync(v => v.Status == VerbStatus.Generated, ct)
        };
    }
}

public class AdminOverviewDto
{
    public int TotalUsers { get; init; }
    public int NewUsers7d { get; init; }
    /// <summary>People with a dated trace of studying in the last 24 hours.</summary>
    public int StudiedToday { get; init; }
    public int Studied7d { get; init; }
    /// <summary>Payments in the last 30 days, refunds not counted.</summary>
    public int Payments30d { get; init; }
    public long Stars30d { get; init; }
    public int ActiveSubscriptions { get; init; }
    public int OnTrial { get; init; }

    // What waits for the owner, per section.
    public int UnansweredMessages { get; init; }
    public int UnfinishedSurveys { get; init; }
    public int UnfinishedBroadcasts { get; init; }
    public int VerbsToReview { get; init; }
}
