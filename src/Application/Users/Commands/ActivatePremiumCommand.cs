using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ActivatePremiumCommand : IRequest<PremiumActivationStatus>
{
    public Guid? UserId { get; set; }
    public DateTime? InvoiceCreatedAdUtc { get; set; }

    public bool IsTrial { get; set; }
    
    public class Handler: IRequestHandler<ActivatePremiumCommand, PremiumActivationStatus>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<PremiumActivationStatus> Handle(ActivatePremiumCommand request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            User? user = await _dbContext.Users.FindAsync(keyValues: keyValues, ct);

            if (request.IsTrial && user.SubscribedUntil != null)
            {
                return PremiumActivationStatus.TrialExpired;
            }
            
            user!.AccountType = UserAccountType.Premium;
            user.SubscribedUntil = request.IsTrial 
                ? request.InvoiceCreatedAdUtc!.Value.AddMonths(1) 
                : request.InvoiceCreatedAdUtc!.Value.AddYears(1);
            
            return PremiumActivationStatus.Success;
        }
    }
}

public enum PremiumActivationStatus
{
    Success,
    TrialExpired
}