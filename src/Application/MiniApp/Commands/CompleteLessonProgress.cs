using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using MediatR;

namespace Application.MiniApp.Commands;

public class CompleteLessonProgress : IRequest<CompleteLessonProgressResult>
{
    public required Guid UserId { get; init; }
    public required string ModuleId { get; init; }
    public required int LessonId { get; init; }
    public required int Correct { get; init; }
    public required int Total { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        IProgressCalculator progressCalculator)
        : IRequestHandler<CompleteLessonProgress, CompleteLessonProgressResult>
    {
        public async Task<CompleteLessonProgressResult> Handle(CompleteLessonProgress request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.ModuleId) || request.Total <= 0)
            {
                return new CompleteLessonProgressResult.InvalidRequest();
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            var update = progressCalculator.CalculateLessonCompletion(
                progress, request.ModuleId, request.LessonId, request.Correct, request.Total);
            await dbContext.SaveChangesAsync(ct);

            return new CompleteLessonProgressResult.Success(
                update.XpEarned,
                progressCalculator.SerializeProgress(progress));
        }
    }
}

public abstract record CompleteLessonProgressResult
{
    public record Success(int XpEarned, object Progress) : CompleteLessonProgressResult;
    public record InvalidRequest : CompleteLessonProgressResult;
}
