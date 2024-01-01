namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public abstract record CreateVocabularyEntryResult
{
    public sealed record TranslationSuccess(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId): CreateVocabularyEntryResult;

    public sealed record TranslationExists(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId): CreateVocabularyEntryResult;

    public sealed record TranslationFailure: CreateVocabularyEntryResult;

    public sealed record PromptLengthExceeded: CreateVocabularyEntryResult;

    public sealed record EmojiDetected: CreateVocabularyEntryResult;
}
