namespace Application.VocabularyEntries.Commands;

public record CreateVocabularyEntryResult(bool isTranslationCompleted, string Translation, Guid VocabularyEntryId);