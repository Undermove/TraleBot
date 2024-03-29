using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Application.Translation.Languages;

public interface ITranslationModule
{
    Language GetLanguage();
    Task<TranslationResult> Translate(string wordToTranslate, CancellationToken ct);
}