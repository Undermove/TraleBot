namespace Application.VocabularyEntries.Commands;

public record CreateVocabularyEntryResult(
    TranslationStatus TranslationStatus, 
    string Definition,
    string AdditionalInfo,
    Guid VocabularyEntryId);

public enum TranslationStatus
{
    CantBeTranslated,
    Translated,
    ReceivedFromVocabulary
}