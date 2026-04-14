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

            return new GetMiniAppProfileResult
            {
                Authenticated = true,
                Language = user.Settings.CurrentLanguage.ToString(),
                VocabularyCount = vocabCount,
                Level = progress.Level,
                Progress = progressCalculator.SerializeProgress(progress)
            };
        }
    }
}

public class GetMiniAppProfileResult
{
    public bool Authenticated { get; init; }
    public string Language { get; init; }
    public int VocabularyCount { get; init; }
    public string Level { get; init; }
    public object Progress { get; init; }
}
