using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using MediatR;

namespace Application.MiniApp.Commands;

// Per-answer progress: credits XP for a correct answer and marks the day as
// trained (streak + heatmap) without waiting for full lesson completion.
public class RecordLessonAnswer : IRequest<RecordLessonAnswerResult>
{
    public required Guid UserId { get; init; }
    public required bool Correct { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        IProgressCalculator progressCalculator)
        : IRequestHandler<RecordLessonAnswer, RecordLessonAnswerResult>
    {
        public async Task<RecordLessonAnswerResult> Handle(RecordLessonAnswer request, CancellationToken ct)
        {
            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            var update = progressCalculator.RecordAnswer(progress, request.Correct);
            await dbContext.SaveChangesAsync(ct);

            return new RecordLessonAnswerResult.Success(
                update.XpEarned,
                progressCalculator.SerializeProgress(progress));
        }
    }
}

public abstract record RecordLessonAnswerResult
{
    public record Success(int XpEarned, object Progress) : RecordLessonAnswerResult;
}
