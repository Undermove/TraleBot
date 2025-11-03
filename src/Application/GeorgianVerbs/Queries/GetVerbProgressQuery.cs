using MediatR;

namespace Application.GeorgianVerbs;

public record GetVerbProgressQuery : IRequest<GetVerbProgressResult>
{
    public required Guid UserId { get; set; }
    public required ProgressRange Range { get; set; }
}

public enum ProgressRange
{
    Daily,
    Weekly
}

public abstract record GetVerbProgressResult
{
    public record ProgressReady(
        int CardsStudiedToday,
        int CorrectAnswers,
        double AccuracyPercentage,
        int CurrentStreak) : GetVerbProgressResult;
    
    public record WeeklyProgressReady(
        int TotalCardsStudied,
        int TotalCorrectAnswers,
        double OverallAccuracy) : GetVerbProgressResult;

    public record ErrorLoadingProgress : GetVerbProgressResult;
}

public class GetVerbProgressHandler : IRequestHandler<GetVerbProgressQuery, GetVerbProgressResult>
{
    private readonly IVerbSrsService _srsService;

    public GetVerbProgressHandler(IVerbSrsService srsService)
    {
        _srsService = srsService;
    }

    public async Task<GetVerbProgressResult> Handle(GetVerbProgressQuery request, CancellationToken ct)
    {
        if (request.Range == ProgressRange.Daily)
        {
            var daily = await _srsService.GetDailyProgressAsync(request.UserId, ct);
            return new GetVerbProgressResult.ProgressReady(
                daily.CardsStudiedToday,
                daily.CorrectAnswers,
                daily.AccuracyPercentage,
                daily.CurrentStreak);
        }
        else
        {
            var weekly = await _srsService.GetWeeklyProgressAsync(request.UserId, ct);
            return new GetVerbProgressResult.WeeklyProgressReady(
                weekly.TotalCardsStudied,
                weekly.TotalCorrectAnswers,
                weekly.OverallAccuracy);
        }
    }
}