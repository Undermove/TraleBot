namespace Application.Common.Interfaces.TranslationService;

public abstract record TranslationResult
{
    public sealed record Success(string Definition, string AdditionalInfo, string Example) : TranslationResult;
    public sealed record Failure : TranslationResult;
    public sealed record PromptLengthExceeded : TranslationResult;

    /// <summary>
    /// The text is not something to translate — gibberish, chat, a command. Nothing was looked up in
    /// external translators and nothing may be saved to the user's dictionary.
    /// </summary>
    public sealed record NotTranslatable : TranslationResult;
}