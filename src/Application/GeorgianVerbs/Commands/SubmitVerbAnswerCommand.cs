using Application.Common;
using Application.GeorgianVerbs;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.GeorgianVerbs.Commands;

public record SubmitVerbAnswerCommand : IRequest<SubmitVerbAnswerResult>
{
    public required Guid UserId { get; set; }
    public required Guid VerbCardId { get; set; }
    public required string StudentAnswer { get; set; }
    public required int Rating { get; set; } // 1-5: 1=ошибка, 5=отлично
}

public abstract record SubmitVerbAnswerResult
{
    public record Success(
        bool IsCorrect,
        string Explanation,
        VerbCard NextCard,
        int Rating) : SubmitVerbAnswerResult;

    public record CardNotFound : SubmitVerbAnswerResult;
    public record UserNotFound : SubmitVerbAnswerResult;
}

public class SubmitVerbAnswerHandler : IRequestHandler<SubmitVerbAnswerCommand, SubmitVerbAnswerResult>
{
    private readonly ITraleDbContext _context;
    private readonly IVerbSrsService _srsService;

    public SubmitVerbAnswerHandler(ITraleDbContext context, IVerbSrsService srsService)
    {
        _context = context;
        _srsService = srsService;
    }

    public async Task<SubmitVerbAnswerResult> Handle(SubmitVerbAnswerCommand request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct);
        if (user == null)
            return new SubmitVerbAnswerResult.UserNotFound();

        var card = await _context.VerbCards
            .Include(vc => vc.Verb)
            .FirstOrDefaultAsync(vc => vc.Id == request.VerbCardId, ct);
        if (card == null)
            return new SubmitVerbAnswerResult.CardNotFound();

        // Проверяем правильность ответа
        var isCorrect = string.Equals(
            card.CorrectAnswer,
            request.StudentAnswer,
            StringComparison.InvariantCultureIgnoreCase);

        // Получаем или создаём прогресс для этой карточки
        var progress = await _context.StudentVerbProgress
            .FirstOrDefaultAsync(sp => sp.UserId == request.UserId && sp.VerbCardId == request.VerbCardId, ct);

        if (progress == null)
        {
            progress = new StudentVerbProgress
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                VerbCardId = request.VerbCardId,
                DateAddedUtc = DateTime.UtcNow,
                NextReviewDateUtc = DateTime.UtcNow.AddDays(1),
                UpdatedAtUtc = DateTime.UtcNow
            };
            _context.StudentVerbProgress.Add(progress);
        }

        // Обновляем прогресс согласно SRS алгоритму
        progress.UpdateFromRating(request.Rating);

        await _context.SaveChangesAsync(ct);

        // Получаем следующую карточку
        var nextCard = await _srsService.GetNextCardForUserAsync(request.UserId, ct);

        return new SubmitVerbAnswerResult.Success(
            isCorrect,
            card.Explanation,
            nextCard!,
            request.Rating);
    }
}