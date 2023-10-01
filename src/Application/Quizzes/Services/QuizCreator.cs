using System.Collections.ObjectModel;
using Domain.Entities;
using Domain.Quiz;
using Nest;

namespace Application.Quizzes.Services;

public class QuizCreator : IQuizCreator
{
    // used only in cases when user dont have enough words to create quiz
    private static readonly (string word, string definition)[] SpareWords = new[]
    {
        ("car", "машина"),
        ("dog", "собака"),
        ("cat", "кошка"),
        ("house", "дом"),
        ("bottle", "бутылка"),
        ("table", "стол"),
        ("chair", "стул"),
        ("window", "окно"),
        ("computer", "компьютер"),
        ("phone", "телефон"),
        ("pen", "ручка"),
        ("pencil", "карандаш"),
        ("book", "книга"),
        ("cup", "чашка"),
        ("glass", "стакан"),
        ("plate", "тарелка"),
        ("fork", "вилка"),
        ("spoon", "ложка"),
        ("knife", "нож"),
        ("bag", "сумка")
    };
    
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
                .Select(ve => SelectQuizQuestionWithVariants(ve, vocabularyEntries))
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
        return new QuizQuestionWithTypeAnswer
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Word,
            Answer = entry.Definition,
            Example = entry.Example
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id,
            QuestionType = nameof(QuizQuestionWithTypeAnswer)
        };
    }
    
    private static QuizQuestion SelectQuizQuestionWithVariants(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries)
    {
        Random rnd = new Random();
        
        return new QuizQuestionWithVariants
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Word,
            Answer = entry.Definition,
            Variants = otherEntries.Count >= 20
                ? CreateVariantsFromQuizQuestions(entry, otherEntries, rnd)
                : CreateVariantsFromSpareWords(entry, otherEntries, rnd) 
            ,
            Example = entry.Example
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id,
            QuestionType = nameof(QuizQuestionWithVariants)
        };
    }

    private static string[] CreateVariantsFromQuizQuestions(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries, Random rnd)
    {
        return otherEntries.Where(ve => ve.Definition != entry.Definition)
            .Select(ve => ve.Definition)
            .OrderBy(_ => rnd.Next())
            .Take(3)
            .Append(entry.Definition)
            .OrderBy(_ => rnd.Next())
            .ToArray();
    }
    
    private static string[] CreateVariantsFromSpareWords(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries, Random rnd)
    {
        var spareWordsDefinition = SpareWords.Select(tuple => tuple.definition).ToArray();
        var userWords = otherEntries.Select(ve => ve.Definition).ToArray();
        var combinedWords = spareWordsDefinition.Concat(userWords).ToArray();
        
        return combinedWords
            .Where(ve => ve != entry.Definition)
            .OrderBy(_ => rnd.Next())
            .Take(3)
            .Append(entry.Definition)
            .OrderBy(_ => rnd.Next())
            .ToArray();
    }

    private static QuizQuestion ReverseQuizQuestion(VocabularyEntry entry)
    {
        return new QuizQuestionWithTypeAnswer
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Definition,
            Answer = entry.Word,
            Example = entry.Example
                // remove word from example to avoid spoiling of correct answer
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id,
        };
    }
}
