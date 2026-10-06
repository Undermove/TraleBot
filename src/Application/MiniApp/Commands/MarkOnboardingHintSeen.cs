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
/// and the ~20h gate to the next hint starts. One-time interface hints (<c>ui:…</c>, see
/// <see cref="OnboardingHints.IsUiHint"/>) are stored in the same list without starting the gate.
/// Unknown hint keys are rejected.
/// </summary>
public class MarkOnboardingHintSeen : IRequest<bool>
{
    public required Guid UserId { get; init; }
    public required string HintKey { get; init; }

    public class Handler(ITraleDbContext dbContext) : IRequestHandler<MarkOnboardingHintSeen, bool>
    {
        public async Task<bool> Handle(MarkOnboardingHintSeen request, CancellationToken ct)
        {
            var uiHint = OnboardingHints.IsUiHint(request.HintKey);
            if (string.IsNullOrWhiteSpace(request.HintKey) || (!uiHint && !OnboardingHints.Order.Contains(request.HintKey)))
            {
                return false;
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            progress.OnboardingHintsJson = uiHint
                ? OnboardingState.MarkUiHintSeen(progress.OnboardingHintsJson, request.HintKey)
                : OnboardingState.MarkSeen(progress.OnboardingHintsJson, request.HintKey, DateTime.UtcNow);
            await dbContext.SaveChangesAsync(ct);
            return true;
        }
    }
}
