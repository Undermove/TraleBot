using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ActivatePremiumCommand : IRequest
{
    public Guid? UserId { get; set; }
    public DateTime? InvoiceCreatedAdUtc { get; set; }
    
    public class Handler: IRequestHandler<ActivatePremiumCommand>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<Unit> Handle(ActivatePremiumCommand request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            User? user = await _dbContext.Users.FindAsync(keyValues: keyValues, ct);

            user!.AccountType = UserAccountType.Premium;
            user.SubscribedUntil = request.InvoiceCreatedAdUtc!.Value.AddYears(1);
            return Unit.Value;
        }
    }
}