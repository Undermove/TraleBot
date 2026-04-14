using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Commands;

public class RecordVocabularyAnswer : IRequest<RecordVocabularyAnswerResult>
{
    public required Guid UserId { get; init; }
    public Guid? WordId { get; init; }
    public required bool Correct { get; init; }
    public string Direction { get; init; } = "ge-to-ru";

    public class Handler(ITraleDbContext dbContext)
        : IRequestHandler<RecordVocabularyAnswer, RecordVocabularyAnswerResult>
    {
        public async Task<RecordVocabularyAnswerResult> Handle(RecordVocabularyAnswer request, CancellationToken ct)
        {
            // Starter words have no WordId — nothing to persist, just ack.
            if (request.WordId == null || request.WordId == Guid.Empty)
            {
                return new RecordVocabularyAnswerResult.Skipped();
            }

            var entry = await dbContext.VocabularyEntries
                .FirstOrDefaultAsync(v => v.Id == request.WordId.Value && v.UserId == request.UserId, ct);

            if (entry == null)
            {
                return new RecordVocabularyAnswerResult.NotFound();
            }

            if (request.Correct)
            {
                var (georgian, _) = MiniAppHelpers.GetSides(entry);
                if (string.Equals(georgian, entry.Definition, StringComparison.InvariantCultureIgnoreCase))
                {
                    entry.SuccessAnswersCount++;
                }
                else
                {
                    entry.SuccessAnswersCountInReverseDirection++;
                }
            }
            else
            {
                entry.FailedAnswersCount++;
            }
            entry.UpdatedAtUtc = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(ct);

            return new RecordVocabularyAnswerResult.Success(
                entry.Id,
                entry.SuccessAnswersCount,
                entry.SuccessAnswersCountInReverseDirection,
                entry.FailedAnswersCount,
                entry.GetMasteringLevel().ToString());
        }
    }
}

public abstract record RecordVocabularyAnswerResult
{
    public record Success(
        Guid Id,
        int SuccessCount,
        int SuccessReverseCount,
        int FailedCount,
        string Mastery) : RecordVocabularyAnswerResult;

    public record Skipped : RecordVocabularyAnswerResult;
    public record NotFound : RecordVocabularyAnswerResult;
}
