using Domain.Entities;

namespace Domain.Quiz;

public interface IQuizCreator
{
    List<QuizQuestion> CreateQuizQuestions(ICollection<VocabularyEntry> vocabularyEntries);
}