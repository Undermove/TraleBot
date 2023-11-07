using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<SomeResult>
{
    public required string Word { get; init; }
    public required Language TargetLanguage { get; init; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, SomeResult>
    {
        public Task<SomeResult> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}

public class SomeResult
{
}