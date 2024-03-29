using Domain.Entities;

namespace Application.Common.Interfaces.TranslationService;

public interface IParsingUniversalTranslator
{
    /// <summary>
    /// Translate <see cref="requestWord"/> using network call to translation service
    /// </summary>
    /// <param name="requestWord">Word to translate</param>
    /// <param name="ct">Cancellation token for inner http client</param>
    /// <returns>Translation of <see cref="requestWord"/></returns>
    Task<TranslationResult> TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct);
}