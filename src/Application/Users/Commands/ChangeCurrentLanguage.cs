using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Users.Commands;

public class ChangeCurrentLanguage : IRequest<Language>
{
    public required User User { get; set; }
    public required Language TargetLanguage { get; set; }
    
    public class Handler : IRequestHandler<ChangeCurrentLanguage, Language>
    {
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public async Task<Language> Handle(ChangeCurrentLanguage request, CancellationToken ct)
        {
            request.User.Settings.CurrentLanguage = request.TargetLanguage;
            await _context.SaveChangesAsync(ct);
            return request.TargetLanguage;
        }
    }
}