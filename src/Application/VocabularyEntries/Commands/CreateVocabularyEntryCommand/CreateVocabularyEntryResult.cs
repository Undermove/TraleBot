namespace Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;

public record CreateVocabularyEntryResult(
    TranslationStatus TranslationStatus, 
    string Definition,
    string AdditionalInfo,
    string Example,
    Guid VocabularyEntryId);