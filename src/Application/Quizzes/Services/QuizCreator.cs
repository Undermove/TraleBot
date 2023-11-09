using Application.Common.Extensions;
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
        ("сумка", "bag"),
        ("საზამთრო", "арбуз"),
        ("арбуз", "საზამთრო"),
        ("вилка", "ჩანგალი"),
        ("ჩანგალი", "вилка"),
        ("მანქანა", "машина"),
        ("машина","მანქანა"),
        ("ხე", "дерево"),
        ("дерево", "ხე"),
        ("თეფში", "тарелка"),
        ("тарелка", "თეფში"),
    };
    
    public ICollection<QuizQuestion> CreateQuizQuestions(ICollection<VocabularyEntry> quizEntries, ICollection<VocabularyEntry> allUserEntries)
    {
        Random rnd = new Random();
        int orderInQuiz = 0;
        var quizWithVariants = quizEntries
            .Select(ve => SelectQuizQuestionWithVariants(ve, allUserEntries, orderInQuiz++))
            .ToList();

        var reverseQuizWithVariants = quizEntries
            .OrderBy(_ => rnd.Next())
            .ToArray()
            .Select(ve => ReverseQuizQuestionWithVariants(ve, allUserEntries, orderInQuiz++))
            .ToArray();
        
        var quizWithTypeAnswer = quizEntries
            .OrderBy(_ => rnd.Next())
            .ToArray()
            .Select(entry => QuizQuestion(entry, orderInQuiz++))
            .ToArray();

        var reverseQuizWithTypeAnswer = quizEntries
            .OrderBy(_ => rnd.Next())
            .ToArray()
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