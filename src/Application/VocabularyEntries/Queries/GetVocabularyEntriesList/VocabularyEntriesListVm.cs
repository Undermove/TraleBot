using Domain.Entities;

namespace Application.VocabularyEntries.Queries.GetVocabularyEntriesList;

public class VocabularyEntriesListVm
{
    public IEnumerable<VocabularyEntry[]> VocabularyEntries { get; init; } = null!;
}

public class VocabularyEntriesPage
{
    public VocabularyEntry[] VocabularyEntries { get; init; } = null!;
}