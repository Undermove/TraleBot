using System.Text.RegularExpressions;
using Domain.Entities;
using Domain.Quiz;

namespace Application.Quizzes.Services;

public class QuizCreator : IQuizCreator
{
    // used only in cases when user dont have enough words to create quiz
    private static readonly (string word, string definition)[] SpareWords = {
        ("car", "машина"),
        ("машина", "car"),
        ("dog", "собака"),
        ("собака", "dog"),
        ("cat", "кошка"),
        ("кошка", "cat"),
        ("house", "дом"),
        ("дом", "house"),
        ("bottle", "бутылка"),
        ("бутылка", "bottle"),
        ("table", "стол"),
        ("стол", "table"),
        ("chair", "стул"),
        ("стул", "chair"),
        ("window", "окно"),
        ("окно", "window"),
        ("computer", "компьютер"),
        ("компьютер", "computer"),
        ("phone", "телефон"),
        ("телефон", "phone"),
        ("pen", "ручка"),
        ("ручка", "pen"),
        ("pencil", "карандаш"),
        ("карандаш", "pencil"),
        ("book", "книга"),
        ("книга", "book"),
        ("cup", "чашка"),
        ("чашка", "cup"),
        ("glass", "стакан"),
        ("стакан", "glass"),
        ("plate", "тарелка"),
        ("тарелка", "plate"),
        ("fork", "вилка"),
        ("вилка", "fork"),
        ("spoon", "ложка"),
        ("ложка", "spoon"),
        ("knife", "нож"),
        ("нож", "knife"),
        ("bag", "сумка"),
        ("сумка", "bag")
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
            Variants = CreateVariantsFromSpareWords(entry, otherEntries, rnd),
            Example = entry.Example
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id,
            QuestionType = nameof(QuizQuestionWithVariants)
        };
    }

    private static string[] CreateVariantsFromQuizQuestions(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries, Random rnd)
    {
        return otherEntries.Where(ve => ve.Definition != entry.Definition 
                                        && entry.Definition.DetectLanguage() == ve.Definition.DetectLanguage())
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
            .Where(ve => ve != entry.Definition 
                         && entry.Definition.DetectLanguage() == ve.DetectLanguage())
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

public static class LanguageDetectionExtensions
{
    public static string DetectLanguage(this string input)
    {
        string englishPattern = @"[\p{IsBasicLatin}]";
        string russianPattern = @"[\p{IsCyrillic}]";
        
        bool containsEnglish = Regex.IsMatch(input, englishPattern);
        bool containsRussian = Regex.IsMatch(input, russianPattern);

        return containsEnglish switch
        {
            true when containsRussian => "Russian",
            true when !containsRussian => "English",
            _ => "Mixed languages or unsupported characters"
        };
    }
}
