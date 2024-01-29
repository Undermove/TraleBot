using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation;

public interface ILanguageTranslator
{
    Task<TranslationResult> Translate(string wordToTranslate, Language targetLanguage, CancellationToken ct);
}