using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Application.Translation.Languages;

public class EnglishTranslationModule(
    IParsingEnglishTranslator parsingEnglishTranslator,
    IAiTranslationService aiTranslationService, 
    ILoggerFactory loggerFactory) : ITranslationModule
{
    public Language GetLanguage() => Language.English;
    private readonly ILogger _logger = loggerFactory.CreateLogger(nameof(EnglishTranslationModule));

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        TranslationResult parsingTranslationResult = new TranslationResult.Failure();
        try
        {
            parsingTranslationResult = await parsingEnglishTranslator.TranslateAsync(wordToTranslate, ct);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error while translating word {Word} in English parser", wordToTranslate);
        }
        
        if (parsingTranslationResult is TranslationResult.Success)
        {
            return parsingTranslationResult;
        }

        try
        {
            return await aiTranslationService.TranslateAsync(wordToTranslate, GetLanguage(), ct);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error while translating word {Word} in AI translator", wordToTranslate);
        }

        return parsingTranslationResult;
    }
}