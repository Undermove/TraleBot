using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation.Languages;

public class EnglishTranslationModule(
    IParsingTranslationService parsingTranslationService,
    IAiTranslationService aiTranslationService) : ITranslationModule
{
    public Language GetLanguage() => Language.English;

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        var parsingTranslationResult = await parsingTranslationService.TranslateAsync(wordToTranslate, ct);
        
        if (parsingTranslationResult is TranslationResult.Success)
        {
            return parsingTranslationResult;
        }
        
        return await aiTranslationService.TranslateAsync(wordToTranslate, GetLanguage(), ct);
    }
}