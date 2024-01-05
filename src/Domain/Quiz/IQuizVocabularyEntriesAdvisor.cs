using Domain.Entities;

namespace Domain.Quiz;

public interface IQuizVocabularyEntriesAdvisor
{
    IEnumerable<VocabularyEntry> AdviceVocabularyEntriesForQuiz(ICollection<VocabularyEntry> vocabularyEntries);
}