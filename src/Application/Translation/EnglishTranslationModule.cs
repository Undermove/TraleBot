using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation;

public class EnglishTranslationModule : ITranslationModule
{
    public Language GetLanguage()
    {
        return Language.English;
    }

    public Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct)
    {
        throw new NotImplementedException();
    }
}

public interface ITranslationModule
{
    Language GetLanguage();
    Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct);
}