namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public record TranslationSuccess(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record TranslationExists(
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);

public record SuggestPremium;

public record TranslationFailure;

public record EmojiDetected;