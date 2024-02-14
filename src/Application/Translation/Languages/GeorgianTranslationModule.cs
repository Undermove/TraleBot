using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Application.Translation.Languages;

public class GeorgianTranslationModule(
    IParsingUniversalTranslator parsingUniversalTranslator,
    IGoogleApiTranslator googleApiTranslator,
    ILoggerFactory loggerFactory
) : ITranslationModule
{
    public Language GetLanguage() => Language.Georgian;
    private readonly ILogger _logger = loggerFactory.CreateLogger(nameof(GeorgianTranslationModule));

    public async Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        TranslationResult parsingResult = new TranslationResult.Failure();
        try
        {
            parsingResult = await parsingUniversalTranslator.TranslateAsync(wordToTranslate, GetLanguage(), ct);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error while translating word {Word} in universal parser", wordToTranslate);
        }

        if (parsingResult is not TranslationResult.Failure)
        {
            return parsingResult;
        }

        try
        {
            parsingResult = await googleApiTranslator.TranslateAsync(wordToTranslate, GetLanguage(), ct);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error while translating word {Word} in google translate", wordToTranslate);
        }

        return parsingResult;
    }
}

public static class GeorgianTranscriptionExtension
{
    public static string GetTranscription(string wordToTranscribe)
    {
        return "sakheli";
    }
}