using Google.Cloud.Translation.V2;
using Application.Common.Interfaces.TranslationService;
using Language = Domain.Entities.Language;
using TranslationResult = Application.Common.Interfaces.TranslationService.TranslationResult;

namespace Infrastructure.Translation.GoogleTranslation
{
    public class GoogleTranslationService(string apiKey) : IGoogleTranslationService
    {
        private readonly TranslationClient _translationClient = TranslationClient.CreateFromApiKey(apiKey);

        public async Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct)
        {
            // You can set the source language and target language based on your requirements
            var sourceLanguage = LanguageCodes.English;
            var targetLanguage = GetLanguageCode(language);

            var response = await _translationClient.TranslateTextAsync(
                text: requestWord,
                targetLanguage: targetLanguage,
                sourceLanguage: sourceLanguage,
                cancellationToken: ct
            );

            // Create a TranslationResult object based on the response from the API
            var translationResult = new TranslationResult.Success(
                response.TranslatedText,
                "",
                ""
            );
            return translationResult;
        }

        private static string GetLanguageCode(Language language)
        {
            // Map your application's language enum to Google Cloud Translation API language codes
            // This is a simple example, you might need to extend it based on your needs
            switch (language)
            {
                case Language.English:
                    return LanguageCodes.English;
                case Language.Georgian:
                    return LanguageCodes.Georgian;
                // Add more cases as needed
                default:
                    return "";
            }
        }
    }
}
