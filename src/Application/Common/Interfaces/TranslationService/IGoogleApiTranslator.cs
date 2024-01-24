using Domain.Entities;

namespace Application.Common.Interfaces.TranslationService;

public interface IGoogleApiTranslator
{
    /// <summary>
    /// Translate <see cref="requestWord"/> using network call to GoogleAPI service
    /// </summary>
    /// <param name="requestWord">Word to translate</param>
    /// <param name="language"></param>
    /// <param name="ct">Cancellation token for inner http client</param>
    /// <returns>Translation of <see cref="requestWord"/></returns>
    Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct);
}