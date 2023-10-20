using Domain.Entities;

namespace Application.UnitTests.DSL;

public class QuizBuilder
{
    private readonly Guid _quizId = Guid.NewGuid();
    private readonly List<QuizQuestion> _quizQuestions = new();
    private bool _isCompleted;
    private readonly DateTime _dateStarted = DateTime.UtcNow;
    private User _createdByUser = new();
    private ShareableQuiz? _shareableQuiz;
    private string _createdByUserName = "NameFromRequest";

    
    public QuizBuilder AddQuizQuestionWithVocabularyEntry(VocabularyEntry vocabularyEntry)
    {
        _quizQuestions.Add(new QuizQuestionWithTypeAnswer()
        {
            Id = Guid.NewGuid(),
            Question = vocabularyEntry.Word,
            Answer = vocabularyEntry.Definition,
            Example = vocabularyEntry.Example,
            VocabularyEntry = vocabularyEntry,
            OrderInQuiz = 0
        });
        
        return this;
    }

    public QuizBuilder CreatedByUser(User user)
    {
        _createdByUser = user;
        return this;
    }
    
    public QuizBuilder WithCompleted()
    {
        _isCompleted = true;
        return this;
    }

    public QuizBuilder WithShareableQuiz()
    {
        _shareableQuiz = new ShareableQuiz
        {
            Id = Guid.NewGuid(),
            QuizType = QuizTypes.ForwardDirection,
            DateAddedUtc = DateTime.UtcNow,
            CreatedByUserId = _createdByUser.Id,
            VocabularyEntriesIds = _quizQuestions.Select(qq => qq.VocabularyEntry.Id).ToList(),
            CreatedByUserName = _createdByUserName
        };
        
        return this;
    }
    
    public Quiz Build()
    {
        return new UserQuiz
        {
            Id = _quizId,
            IsCompleted = _isCompleted,
            DateStarted = _dateStarted,
            QuizQuestions = _quizQuestions,
            User = _createdByUser,
            ShareableQuiz = _shareableQuiz
        };
    }
}