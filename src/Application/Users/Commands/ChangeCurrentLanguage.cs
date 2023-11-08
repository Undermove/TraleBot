using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ChangeCurrentLanguage : IRequest
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler : IRequestHandler<ChangeCurrentLanguage>
    {
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public async Task<Unit> Handle(ChangeCurrentLanguage request, CancellationToken ct)
        {
            request.User.Settings.CurrentLanguage = request.TargetLanguage;
            await _context.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}