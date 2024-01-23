using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation.Languages;

public class GeorgianTranslationModule(
    IParsingUniversalTranslator parsingUniversalTranslator,
    IGoogleTranslationService googleTranslationService
    
) : ITranslationModule
{
    public Language GetLanguage() => Language.Georgian;

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        var parsingResult = await parsingUniversalTranslator.TranslateAsync(wordToTranslate, GetLanguage(), ct);
        
        if (parsingResult is TranslationResult.Failure)
        {
            parsingResult = await googleTranslationService.TranslateAsync(wordToTranslate, GetLanguage(), ct);
        }

        return parsingResult;
    }
}