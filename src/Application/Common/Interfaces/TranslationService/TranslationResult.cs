namespace Application.Common.Interfaces.TranslationService;

public abstract record TranslationResult
{
    public sealed record Success(string Definition, string AdditionalInfo, string Example) : TranslationResult;
    public sealed record Failure : TranslationResult;
    public sealed record PromptLengthExceeded : TranslationResult;
}