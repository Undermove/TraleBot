using Domain.Entities;

namespace Domain.Quiz;

public class QuizCreator : IQuizCreator
{
    public List<QuizQuestion> CreateQuizQuestions(User user, QuizTypes quizType)
    {
        Random rnd = new Random();

        var vocabularyEntries = quizType switch
        {
            QuizTypes.LastWeek => user.VocabularyEntries.Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                .OrderBy(entry => entry.DateAdded)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.SeveralComplicatedWords => user.VocabularyEntries
                .Where(entry => entry.SuccessAnswersCount < entry.FailedAnswersCount)
                .OrderBy(_ => rnd.Next())
                .Take(10)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.ForwardDirection => user.VocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.ReverseDirection => user.VocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select(ReverseQuizQuestion)
                .ToList(),
            _ => new List<QuizQuestion>()
        };

        return vocabularyEntries;
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