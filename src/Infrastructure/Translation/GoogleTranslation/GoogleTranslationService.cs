using Application.Common.Interfaces.TranslationService;
using Domain.Entities;

namespace Infrastructure.Translation.GoogleTranslation;

public class GoogleTranslationService : IGoogleTranslationService
{
    public Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct)
    {
        throw new NotImplementedException();
    }
}