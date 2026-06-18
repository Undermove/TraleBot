using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Onboarding;
using MediatR;

namespace Application.MiniApp.Commands;

/// <summary>
/// Records that the mini-app surfaced an onboarding hint to the user, so it isn't shown again
/// and the ~20h gate to the next hint starts. Unknown hint keys are rejected.
/// </summary>
public class MarkOnboardingHintSeen : IRequest<bool>
{
    public required Guid UserId { get; init; }
    public required string HintKey { get; init; }

    public class Handler(ITraleDbContext dbContext) : IRequestHandler<MarkOnboardingHintSeen, bool>
    {
        public async Task<bool> Handle(MarkOnboardingHintSeen request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.HintKey) || !OnboardingHints.Order.Contains(request.HintKey))
            {
                return false;
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            progress.OnboardingHintsJson =
                OnboardingState.MarkSeen(progress.OnboardingHintsJson, request.HintKey, DateTime.UtcNow);
            await dbContext.SaveChangesAsync(ct);
            return true;
        }
    }
}
