using Domain.Entities;

namespace Domain.Quiz;

public interface IQuizCreator
{
    ICollection<QuizQuestion> CreateQuizQuestions(ICollection<VocabularyEntry> quizEntries, ICollection<VocabularyEntry> allUserEntries);
}