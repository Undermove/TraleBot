using Domain.Entities;

namespace Application.UnitTests.DSL;

public class QuizBuilder
{
    private readonly Guid _quizId = Guid.NewGuid();
    private readonly List<QuizQuestion> _quizQuestions = new();
    private readonly bool _isCompleted = false;
    private readonly DateTime _dateStarted = DateTime.UtcNow;
    private User _createdByUser = new();

    
    public QuizBuilder AddQuizQuestionWithVocabularyEntry(VocabularyEntry vocabularyEntry)
    {
        _quizQuestions.Add(new QuizQuestion
        {
            Id = Guid.NewGuid(),
            Question = vocabularyEntry.Word,
            Answer = vocabularyEntry.Definition,
            Example = vocabularyEntry.Example,
            VocabularyEntry = vocabularyEntry
        });
        
        return this;
    }
    
    public Quiz Build()
    {
        return new Quiz
        {
            Id = _quizId,
            IsCompleted = _isCompleted,
            DateStarted = _dateStarted,
            QuizQuestions = _quizQuestions,
            User = _createdByUser
        };
    }

    public QuizBuilder CreatedByUser(User user)
    {
        _createdByUser = user;
        return this;
    }
}