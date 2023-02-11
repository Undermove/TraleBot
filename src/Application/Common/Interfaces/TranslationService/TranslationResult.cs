namespace Application.Common.Interfaces.TranslationService;

public record TranslationResult(string Definition, string AdditionalInfo, Language Language, bool IsSuccessful);