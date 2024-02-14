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
    private static readonly Dictionary<string, string> Transcription = new()
    {
        { "ა", "a" },
        { "ბ", "b" },
        { "გ", "g" },
        { "დ", "d" },
        { "ე", "e" },
        { "ვ", "v" },
        { "ზ", "z" },
        { "თ", "t" },
        { "ი", "i" },
        { "კ", "k" },
        { "ლ", "l" },
        { "მ", "m" },
        { "ნ", "n" },
        { "ო", "o" },
        { "პ", "p" },
        { "ჟ", "zh" },
        { "რ", "r" },
        { "ს", "s" },
        { "ტ", "t'" },
        { "უ", "u" },
        { "ფ", "p'" },
        { "ქ", "k'" },
        { "ღ", "gh" },
        { "ყ", "q'" },
        { "შ", "sh" },
        { "ჩ", "ch" },
        { "ც", "c" },
        { "ძ", "dz" },
        { "წ", "ts'" },
        { "ჭ", "ch'" },
        { "ხ", "kh" },
        { "ჯ", "j" },
        { "ჰ", "h" }
    };

    public static string GetTranscription(string wordToTranscribe)
    {
        return string.Join("",
            wordToTranscribe.Select(c => Transcription.GetValueOrDefault(c.ToString(), c.ToString())));
    }
}