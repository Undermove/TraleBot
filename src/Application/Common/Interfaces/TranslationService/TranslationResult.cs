namespace Application.Common.Interfaces.TranslationService;

public record TranslationResult(
	string Definition, 
	string AdditionalInfo, 
	string Example, 
	bool IsSuccessful);