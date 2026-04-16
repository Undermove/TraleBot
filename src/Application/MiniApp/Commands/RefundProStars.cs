using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

public class RefundProStars : IRequest<RefundProStarsResult>
{
    public required Guid UserId { get; init; }
    public string? ChargeId { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        ITelegramRefundClient refundClient,
        ILoggerFactory loggerFactory)
        : IRequestHandler<RefundProStars, RefundProStarsResult>
    {
        private readonly ILogger _logger = loggerFactory.CreateLogger<Handler>();

        public async Task<RefundProStarsResult> Handle(RefundProStars request, CancellationToken ct)
        {
            var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct);
            if (user == null)
            {
                return RefundProStarsResult.UserNotFound;
            }

            Payment? payment;
            if (!string.IsNullOrEmpty(request.ChargeId))
            {
                payment = await dbContext.Payments.FirstOrDefaultAsync(
                    p => p.UserId == user.Id && p.TelegramPaymentChargeId == request.ChargeId,
                    ct);
            }
            else
            {
                payment = await dbContext.Payments
                    .Where(p => p.UserId == user.Id && p.RefundedAtUtc == null)
                    .OrderByDescending(p => p.PurchasedAtUtc)
                    .FirstOrDefaultAsync(ct);
            }

            if (payment == null)
            {
                return RefundProStarsResult.PaymentNotFound;
            }

            if (payment.RefundedAtUtc != null)
            {
                return RefundProStarsResult.AlreadyRefunded;
            }

            // 21-day Telegram window
            if ((DateTime.UtcNow - payment.PurchasedAtUtc).TotalDays > 21)
            {
                return RefundProStarsResult.RefundWindowExpired;
            }

            var ok = await refundClient.RefundStarPaymentAsync(
                user.TelegramId,
                payment.TelegramPaymentChargeId,
                ct);

            if (!ok)
            {
                return RefundProStarsResult.TelegramError;
            }

            payment.RefundedAtUtc = DateTime.UtcNow;
            user.IsPro = false;
            user.SubscriptionPlan = null;
            user.SubscribedUntil = null;
            await dbContext.SaveChangesAsync(ct);

            _logger.LogInformation("Refund processed for user {UserId}, payment {ChargeId}",
                user.Id, payment.TelegramPaymentChargeId);

            return RefundProStarsResult.Success;
        }
    }
}

public enum RefundProStarsResult
{
    Success,
    UserNotFound,
    PaymentNotFound,
    AlreadyRefunded,
    RefundWindowExpired,
    TelegramError
}

public interface ITelegramRefundClient
{
    Task<bool> RefundStarPaymentAsync(long userId, string chargeId, CancellationToken ct);
}
