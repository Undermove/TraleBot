using Domain.Entities;
using MediatR;

namespace Application.GeorgianVerbs;

public record GetHardVerbCardsQuery : IRequest<GetHardVerbCardsResult>
{
    public required Guid UserId { get; set; }
    public int Limit { get; set; } = 5;
}

public abstract record GetHardVerbCardsResult
{
    public record CardsFound(List<VerbCard> Cards) : GetHardVerbCardsResult;
    public record NoCardsFound : GetHardVerbCardsResult;
}

public class GetHardVerbCardsHandler : IRequestHandler<GetHardVerbCardsQuery, GetHardVerbCardsResult>
{
    private readonly IVerbSrsService _srsService;

    public GetHardVerbCardsHandler(IVerbSrsService srsService)
    {
        _srsService = srsService;
    }

    public async Task<GetHardVerbCardsResult> Handle(GetHardVerbCardsQuery request, CancellationToken ct)
    {
        var cards = await _srsService.GetHardCardsForUserAsync(request.UserId, request.Limit, ct);
        
        if (!cards.Any())
            return new GetHardVerbCardsResult.NoCardsFound();

        return new GetHardVerbCardsResult.CardsFound(cards);
    }
}