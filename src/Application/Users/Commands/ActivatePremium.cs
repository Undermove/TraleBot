using Application.Common;
using Application.Invoices;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ActivatePremium : IRequest<PremiumActivationStatus>
{
    public Guid? UserId { get; set; }
    public DateTime? InvoiceCreatedAdUtc { get; set; }
    public SubscriptionTerm SubscriptionTerm { get; set; }
    public bool IsTrial { get; set; }
    
    public class Handler: IRequestHandler<ActivatePremium, PremiumActivationStatus>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<PremiumActivationStatus> Handle(ActivatePremium request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            User? user = await _dbContext.Users.FindAsync(keyValues: keyValues, ct);

            if (request.IsTrial && user?.SubscribedUntil != null)
            {
                return PremiumActivationStatus.TrialExpired;
            }
            
            user!.AccountType = UserAccountType.Premium;

            if (request.IsTrial)
            {
                // Old manual-trial path. Trial is now automatic via RegisteredAtUtc (30 days),
                // so this path is only kept for backwards compat with the bot's /activate_trial command.
                // Do NOT set IsPro — the user stays on the automatic trial entitlement.
                user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(1);
            }
            else
            {
                // Paid subscription via old invoice path (pre-Stars). Mirror what ActivateProStars does.
                user.IsPro = true;
                switch (request.SubscriptionTerm)
                {
                    case SubscriptionTerm.Month:
                        user.SubscriptionPlan = Domain.Entities.SubscriptionPlan.Month;
                        user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(1);
                        break;
                    case SubscriptionTerm.ThreeMonth:
                        user.SubscriptionPlan = Domain.Entities.SubscriptionPlan.Quarter;
                        user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(3);
                        break;
                    case SubscriptionTerm.Year:
                        user.SubscriptionPlan = Domain.Entities.SubscriptionPlan.Year;
                        user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddYears(1);
                        break;
                    default:
                        throw new ArgumentOutOfRangeException();
                }
            }

            await _dbContext.SaveChangesAsync(ct);
            
            return PremiumActivationStatus.Success;
        }
    }
}