using Domain.Entities;

namespace Domain.Quiz;

public interface IQuizVocabularyEntriesAdvisor
{
    ICollection<VocabularyEntry> AdviceVocabularyEntriesForQuiz(ICollection<VocabularyEntry> vocabularyEntries);
}