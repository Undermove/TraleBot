using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguageCommand: IRequest<SomeResult>
{
    public required string Word { get; init; }
    public required Language TargetLanguage { get; init; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguageCommand, SomeResult>
    {
        public Task<SomeResult> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguageCommand request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}

public class SomeResult
{
}