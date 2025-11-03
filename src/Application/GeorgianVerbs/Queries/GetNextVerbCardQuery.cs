using Domain.Entities;
using MediatR;

namespace Application.GeorgianVerbs;

public record GetNextVerbCardQuery : IRequest<GetNextVerbCardResult>
{
    public required Guid UserId { get; set; }
}

public abstract record GetNextVerbCardResult
{
    public record CardReady(VerbCard Card) : GetNextVerbCardResult;
    public record NoCardsAvailable : GetNextVerbCardResult;
}

public class GetNextVerbCardHandler : IRequestHandler<GetNextVerbCardQuery, GetNextVerbCardResult>
{
    private readonly IVerbSrsService _srsService;

    public GetNextVerbCardHandler(IVerbSrsService srsService)
    {
        _srsService = srsService;
    }

    public async Task<GetNextVerbCardResult> Handle(GetNextVerbCardQuery request, CancellationToken ct)
    {
        var card = await _srsService.GetNextCardForUserAsync(request.UserId, ct);
        
        if (card == null)
            return new GetNextVerbCardResult.NoCardsAvailable();

        return new GetNextVerbCardResult.CardReady(card);
    }
}