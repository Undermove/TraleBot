using Domain.Entities;
using MediatR;
using OneOf;

namespace Application.VocabularyEntries.Commands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguage: IRequest<OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>>
{
    public required string Word { get; init; }
    public required Language TargetLanguage { get; init; }

    public class Handler : IRequestHandler<TranslateToAnotherLanguageAndChangeCurrentLanguage, OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>>
    {
        public Task<OneOf<TranslationSuccess, TranslationExists, SuggestPremium, TranslationFailure>> Handle(TranslateToAnotherLanguageAndChangeCurrentLanguage request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}

public record TranslationSuccess(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record TranslationExists(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record SuggestPremium;

public record TranslationFailure;