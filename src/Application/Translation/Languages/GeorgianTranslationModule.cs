using System.Text;
using Application.Common.Extensions;
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
        TranslationResult parsingResult = await GetTranslation(wordToTranslate, ct);

        if (parsingResult is not TranslationResult.Success result)
        {
            return parsingResult;
        }
        
        var transcription = wordToTranslate.DetectLanguage() == Language.Georgian
            ? GeorgianTranscriptionExtension.GetTranscription(wordToTranslate)
            : GeorgianTranscriptionExtension.GetTranscription(result.Definition);
            
        parsingResult = result with
        {
            AdditionalInfo = $"""
                              {result.AdditionalInfo}
                              Транскрипция: [{transcription}]
                              """ 
        };

        return parsingResult;
    }

    private async Task<TranslationResult> GetTranslation(string wordToTranslate, CancellationToken ct)
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
    // Cyrillic, as everywhere a learner sees a transcription — the same table as cyr() in the
    // mini-app (miniapp-src/src/verbs/types.ts). ’ marks the abrupt (ejective) consonants.
    private static readonly Dictionary<string, string> Transcription = new()
    {
        { "ა", "а" }, { "ბ", "б" }, { "გ", "г" }, { "დ", "д" }, { "ე", "э" }, { "ვ", "в" }, { "ზ", "з" },
        { "თ", "т" }, { "ი", "и" }, { "კ", "к’" }, { "ლ", "л" }, { "მ", "м" }, { "ნ", "н" }, { "ო", "о" },
        { "პ", "п’" }, { "ჟ", "ж" }, { "რ", "р" }, { "ს", "с" }, { "ტ", "т’" }, { "უ", "у" }, { "ფ", "п" },
        { "ქ", "к" }, { "ღ", "гх" }, { "ყ", "къ" }, { "შ", "ш" }, { "ჩ", "ч" }, { "ც", "ц" }, { "ძ", "дз" },
        { "წ", "ц’" }, { "ჭ", "ч’" }, { "ხ", "х" }, { "ჯ", "дж" }, { "ჰ", "х" }
    };

    public static string GetTranscription(string wordToTranscribe)
    {
        var sb = new StringBuilder();
        return sb.AppendJoin("",
                wordToTranscribe
                    .Select(c => Transcription.GetValueOrDefault(c.ToString(), c.ToString()))
                )
            .ToString();
    }
}