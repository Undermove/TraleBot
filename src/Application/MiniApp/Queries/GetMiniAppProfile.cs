using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

public class GetMiniAppProfile : IRequest<GetMiniAppProfileResult>
{
    public required Guid UserId { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        IProgressCalculator progressCalculator)
        : IRequestHandler<GetMiniAppProfile, GetMiniAppProfileResult>
    {
        public async Task<GetMiniAppProfileResult> Handle(GetMiniAppProfile request, CancellationToken ct)
        {
            var user = await dbContext.Users
                .Include(u => u.Settings)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, ct);

            if (user == null)
            {
                return new GetMiniAppProfileResult
                {
                    Authenticated = false
                };
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, user.Id, ct);
            await dbContext.SaveChangesAsync(ct);

            var vocabCount = await dbContext.VocabularyEntries
                .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
                .CountAsync(ct);

            // 30-day free trial from registration
            const int trialDays = 30;
            var now = DateTime.UtcNow;
            var trialEndsAt = user.RegisteredAtUtc.AddDays(trialDays);
            var trialDaysLeft = (int)Math.Ceiling((trialEndsAt - now).TotalDays);
            var isTrialActive = !user.IsPro && trialDaysLeft > 0;

            // Owner has English fallback and debug tooling
            const long ownerTelegramId = 309149393;
            var isOwner = user.TelegramId == ownerTelegramId;

            return new GetMiniAppProfileResult
            {
                Authenticated = true,
                TelegramId = user.TelegramId,
                Language = user.Settings.CurrentLanguage.ToString(),
                VocabularyCount = vocabCount,
                Level = progress.Level,
                Progress = progressCalculator.SerializeProgress(progress),
                IsPro = user.IsPro,
                IsTrialActive = isTrialActive,
                TrialDaysLeft = isTrialActive ? trialDaysLeft : 0,
                SubscriptionPlan = user.SubscriptionPlan?.ToString(),
                SubscribedUntil = user.SubscribedUntil,
                IsOwner = isOwner
            };
        }
    }
}

public class GetMiniAppProfileResult
{
    public bool Authenticated { get; init; }
    public long TelegramId { get; init; }
    public string Language { get; init; }
    public int VocabularyCount { get; init; }
    public string Level { get; init; }
    public object Progress { get; init; }
    public bool IsPro { get; init; }
    public bool IsTrialActive { get; init; }
    public int TrialDaysLeft { get; init; }
    public string? SubscriptionPlan { get; init; }
    public DateTime? SubscribedUntil { get; init; }
    public bool IsOwner { get; init; }
}
