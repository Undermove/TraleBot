using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

public class ActivateProStars : IRequest<ActivateProStarsResult>
{
    public required Guid UserId { get; init; }
    public string? Payload { get; init; }
    public string? ChargeId { get; init; }
    public int? Amount { get; init; }
    public string? Currency { get; init; }

    public class Handler(ITraleDbContext dbContext, ILoggerFactory loggerFactory)
        : IRequestHandler<ActivateProStars, ActivateProStarsResult>
    {
        private readonly ILogger _logger = loggerFactory.CreateLogger<Handler>();

        public async Task<ActivateProStarsResult> Handle(ActivateProStars request, CancellationToken ct)
        {
            var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct);
            if (user == null)
            {
                _logger.LogWarning("User {UserId} not found when activating Pro Stars", request.UserId);
                return ActivateProStarsResult.UserNotFound;
            }

            var planInfo = request.Payload != null ? SubscriptionPlans.ByPayload(request.Payload) : null;
            var now = DateTime.UtcNow;
            var wasAlreadyPro = user.IsPro;

            if (!wasAlreadyPro)
            {
                user.IsPro = true;
                user.ProPurchasedAtUtc = now;
            }
            else
            {
                _logger.LogInformation("User {UserId} already has Pro, recording payment anyway",
                    request.UserId);
            }

            if (planInfo != null)
            {
                user.SubscriptionPlan = planInfo.Plan;

                if (planInfo.Plan == SubscriptionPlan.Lifetime)
                {
                    user.SubscribedUntil = null; // null = no expiration for lifetime
                }
                else if (planInfo.DurationDays.HasValue)
                {
                    // If user already has active subscription, extend from the later of (now, current expiry)
                    var startFrom = user.SubscribedUntil.HasValue && user.SubscribedUntil.Value > now
                        ? user.SubscribedUntil.Value
                        : now;
                    user.SubscribedUntil = startFrom.AddDays(planInfo.DurationDays.Value);
                }
            }

            // Record payment transaction for analytics and refunds
            if (planInfo != null && !string.IsNullOrEmpty(request.ChargeId))
            {
                var existing = await dbContext.Payments
                    .FirstOrDefaultAsync(p => p.TelegramPaymentChargeId == request.ChargeId, ct);

                if (existing == null)
                {
                    dbContext.Payments.Add(new Payment
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        TelegramPaymentChargeId = request.ChargeId!,
                        PayloadId = request.Payload ?? planInfo.PayloadId,
                        Plan = planInfo.Plan,
                        Amount = request.Amount ?? planInfo.StarsPrice,
                        Currency = request.Currency ?? "XTR",
                        PurchasedAtUtc = now
                    });
                }
            }

            await dbContext.SaveChangesAsync(ct);

            _logger.LogInformation("Pro Stars activated for user {UserId} plan {Plan}",
                request.UserId, planInfo?.Plan.ToString() ?? "legacy");

            // AlreadyPro only when user was already Pro AND no new payment payload arrived
            // (extension payments still report Success).
            return wasAlreadyPro && request.Payload == null
                ? ActivateProStarsResult.AlreadyPro
                : ActivateProStarsResult.Success;
        }
    }
}

public enum ActivateProStarsResult
{
    Success,
    AlreadyPro,
    UserNotFound
}
