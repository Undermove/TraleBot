namespace Application.VocabularyEntries.Commands;

public record CreateVocabularyEntryResult(TranslationStatus TranslationStatus, string Translation, Guid VocabularyEntryId);

public enum TranslationStatus
{
    CantBeTranslated,
    Translated,
    ReceivedFromVocabulary
}