using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

public class ActivateProStars : IRequest<ActivateProStarsResult>
{
    public required Guid UserId { get; init; }

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

            if (user.IsPro)
            {
                _logger.LogInformation("User {UserId} already has Pro", request.UserId);
                return ActivateProStarsResult.AlreadyPro;
            }

            user.IsPro = true;
            user.ProPurchasedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            _logger.LogInformation("Pro Stars activated for user {UserId}", request.UserId);
            return ActivateProStarsResult.Success;
        }
    }
}

public enum ActivateProStarsResult
{
    Success,
    AlreadyPro,
    UserNotFound
}
