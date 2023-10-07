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
                .Where(ve => ve.DateAdded > DateTime.Now.AddDays(-7))
                .OrderBy(entry => entry.DateAdded)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.SeveralComplicatedWords => vocabularyEntries
                .Where(ve => ve.SuccessAnswersCount < ve.FailedAnswersCount)
                .OrderBy(_ => rnd.Next())
                .Take(10)
                .Select(QuizQuestion)
                .ToList(),
            QuizTypes.ForwardDirection => vocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select((ve, i) => SelectQuizQuestionWithVariants(ve, vocabularyEntries, i))
                .ToList(),
            QuizTypes.ReverseDirection => vocabularyEntries
                .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
                .OrderBy(entry => entry.DateAdded)
                .Take(20)
                .Select(ReverseQuizQuestion)
                .ToList(),
            QuizTypes.SmartQuiz => CreateSmartQuizQuestions(vocabularyEntries),
            _ => new List<QuizQuestion>()
        };

        return quizQuestions;
    }

    private List<QuizQuestion> CreateSmartQuizQuestions(ICollection<VocabularyEntry> vocabularyEntries)
    {
        const int notMasteredWordsCount = 3;
        const int masteredInForwardDirectionCount = 2;
        const int masteredInBothDirectionsCount = 2;
        var notMastered = vocabularyEntries.Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
            .OrderBy(entry => entry.DateAdded)
            .Take(notMasteredWordsCount)
            .ToArray();
        var masteredInForwardDirection = vocabularyEntries.Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
            .OrderBy(entry => entry.DateAdded)
            .Take(masteredInForwardDirectionCount)
            .ToArray();
        var masteredInBothDirections = vocabularyEntries.Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInBothDirections)
            .OrderBy(entry => entry.DateAdded)
            .Take(masteredInBothDirectionsCount)
            .ToArray();
        var entriesForQuiz = notMastered.Concat(masteredInForwardDirection).Concat(masteredInBothDirections).ToList();
        return SmartQuizQuestionsForMasteringLevel(entriesForQuiz, vocabularyEntries)
            .ToList();
    }

    private static List<QuizQuestion> SmartQuizQuestionsForMasteringLevel(ICollection<VocabularyEntry> quizEntries, ICollection<VocabularyEntry> allEntries)
    {
        int orderInQuiz = 0;
        var quizWithVariants = quizEntries
            .Select(ve => SelectQuizQuestionWithVariants(ve, allEntries, orderInQuiz++))
            .ToList();

        var reverseQuizWithVariants = quizEntries
            .Select(ve => ReverseQuizQuestionWithVariants(ve, allEntries, orderInQuiz++))
            .ToArray();
        
        var quizWithTypeAnswer = quizEntries
            .Select(entry => QuizQuestion(entry, orderInQuiz++))
            .ToArray();

        var reverseQuizWithTypeAnswer = quizEntries
            .Select(ve => ReverseQuizQuestion(ve, orderInQuiz++))
            .ToArray();

        return quizWithVariants
            .Concat(reverseQuizWithVariants)
            .Concat(quizWithTypeAnswer)
            .Concat(reverseQuizWithTypeAnswer)
            .ToList();
    }

    private static QuizQuestion QuizQuestion(VocabularyEntry entry, int orderNumber)
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
            QuestionType = nameof(QuizQuestionWithTypeAnswer),
            OrderInQuiz = orderNumber
        };
    }
    
    private static QuizQuestion SelectQuizQuestionWithVariants(VocabularyEntry entry,
        ICollection<VocabularyEntry> otherEntries, int orderInQuiz)
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
            QuestionType = nameof(QuizQuestionWithVariants), 
            OrderInQuiz = orderInQuiz
        };
    }
    
    private static QuizQuestion ReverseQuizQuestionWithVariants(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries, int orderInQuiz)
    {
        Random rnd = new Random();
        
        return new QuizQuestionWithVariants
        {
            Id = Guid.NewGuid(),
            VocabularyEntry = entry,
            Question = entry.Definition,
            Answer = entry.Word,
            Variants = CreateVariantsFromSpareWordsForReverseQuiz(entry, otherEntries, rnd),
            Example = entry.Example
                .ReplaceWholeWord(entry.Word, "______")
                .ReplaceWholeWord(entry.Definition, "______"),
            VocabularyEntryId = entry.Id,
            QuestionType = nameof(QuizQuestionWithVariants),
            OrderInQuiz = orderInQuiz
        };
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
    
    private static string[] CreateVariantsFromSpareWordsForReverseQuiz(VocabularyEntry entry, ICollection<VocabularyEntry> otherEntries, Random rnd)
    {
        var spareWordsDefinition = SpareWords.Select(tuple => tuple.word).ToArray();
        var userWords = otherEntries.Select(ve => ve.Word).ToArray();
        var combinedWords = spareWordsDefinition.Concat(userWords).ToArray();
        
        return combinedWords
            .Where(ve => ve != entry.Word 
                         && entry.Word.DetectLanguage() == ve.DetectLanguage())
            .OrderBy(_ => rnd.Next())
            .Take(3)
            .Append(entry.Word)
            .OrderBy(_ => rnd.Next())
            .ToArray();
    }

    private static QuizQuestion ReverseQuizQuestion(VocabularyEntry entry, int orderInQuiz)
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
            OrderInQuiz = orderInQuiz
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
