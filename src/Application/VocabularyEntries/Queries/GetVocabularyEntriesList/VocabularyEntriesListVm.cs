using Domain.Entities;

namespace Application.VocabularyEntries.Queries.GetVocabularyEntriesList;

public class VocabularyEntriesListVm
{
    public int VocabularyWordsCount { get; init; }
    public IEnumerable<VocabularyEntry[]> VocabularyEntriesPages { get; init; } = null!;
}