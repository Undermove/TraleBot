namespace Application.Common.Interfaces;

public interface ITranslationService
{
    Task<string> TranslateAsync(string requestWord, CancellationToken ct);
}