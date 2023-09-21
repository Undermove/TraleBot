using Domain.Entities;
using Domain.Quiz;

namespace Application.Quizzes.Services;

public class QuizCreator : IQuizCreator
{
    public List<QuizQuestion> CreateQuizQuestions(ICollection<VocabularyEntry> vocabularyEntries, QuizTypes quizType)
    {
        Random rnd = new Random();

        var quizQuestions = quizType switch
        {
            QuizTypes.LastWeek => vocabularyEntries
                .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                .OrderBy(entry => entry.DateAdded)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.SeveralComplicatedWords => vocabularyEntries
                .Where(entry => entry.SuccessAnswersCount < entry.FailedAnswersCount)
                .OrderBy(_ => rnd.Next())
                .Take(10)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.ForwardDirection => vocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.ReverseDirection => vocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select(ReverseQuizQuestion)
                .ToList(),
            _ => new List<QuizQuestion>()
        };

        return quizQuestions;
    }

    private static QuizQuestion QuizQuestion(VocabularyEntry entry)
    {
        return new QuizQuestion
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Word,
            Answer = entry.Definition,
            Example = entry.Example
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id
        };
    }

    private static QuizQuestion ReverseQuizQuestion(VocabularyEntry entry)
    {
        return new QuizQuestion
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Definition,
            Answer = entry.Word,
            Example = entry.Example
                // remove word from example to avoid spoiling of correct answer
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id
        };
    }
}