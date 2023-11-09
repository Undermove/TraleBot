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
                user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(1);
            }
            else
            {
                switch (request.SubscriptionTerm)
                {
                    case SubscriptionTerm.Month:
                        user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(1);
                        break;
                    case SubscriptionTerm.ThreeMonth:
                        user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddMonths(3);
                        break;
                    case SubscriptionTerm.Year:
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