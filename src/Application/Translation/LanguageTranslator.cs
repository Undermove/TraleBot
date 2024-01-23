using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation;

public class LanguageTranslator : ILanguageTranslator
{
    private readonly Dictionary<Language, ITranslationModule> _translationModules;

    public LanguageTranslator(IEnumerable<ITranslationModule> translationModules)
    {
        _translationModules = translationModules.ToDictionary(module => module.GetLanguage(), module => module);
    }

    public Task<TranslationResult> Translate(string wordToTranslate, Language targetLanguage, CancellationToken ct)
    {
        return _translationModules[targetLanguage].Translate(wordToTranslate, ct);
    }
}