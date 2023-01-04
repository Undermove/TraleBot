using Domain.Entities;

namespace Application.VocabularyEntries.Queries.GetVocabularyEntriesList;

public class VocabularyEntriesListVm
{
    public IList<VocabularyEntry> VocabularyEntries { get; init; } = null!;
}