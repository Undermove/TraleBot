namespace Application.Common.Interfaces;

public interface ITranslationService
{
    /// <summary>
    /// Translate <see cref="requestWord"/> using network call to translation service
    /// </summary>
    /// <param name="requestWord">Word to translate</param>
    /// <param name="ct">Cancellation token for inner http client</param>
    /// <exception cref="UntranslatableWordException">Throws in case when translation service can't provide correct translation</exception>
    /// <returns>Translation of <see cref="requestWord"/></returns>
    Task<string> TranslateAsync(string requestWord, CancellationToken ct);
}