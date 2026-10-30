using Application.Quizzes.Services;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class QuizCreatorTests
{
    [Test]
    public void WhenUserHasNoWords_ReturnsSpareWords()
    {
        // Arrange
        var quizCreator = new QuizCreator();
        var vocabularyEntries = CreateVocabularyWith(1,1,1);

        // Act
        var quizQuestions = quizCreator.CreateQuizQuestions(vocabularyEntries, vocabularyEntries).ToList();

        // Assert
        quizQuestions.Count.ShouldBe(12);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 4, MasteringLevel.NotMastered);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 4, MasteringLevel.MasteredInForwardDirection);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 4, MasteringLevel.MasteredInBothDirections);
    }

    [Test]
    public void ReverseQuestion_SaysWhichVerbTheGeorgianNameStandsFor()
    {
        // კითხვა is the name of both «читать» and «спрашивать»: the «я» form in brackets tells them apart
        var read = Create.VocabularyEntry().WithWord("читать").WithDefinition("კითხვა")
            .WithAdditionalInfo("название действия; «я читаю» — ვკითხულობ; «он читает» — კითხულობს\nтранскрипция: [к’итхва]").Build();
        var ask = Create.VocabularyEntry().WithWord("спрашивать").WithDefinition("კითხვა")
            .WithAdditionalInfo("название действия; «я спрашиваю» — ვეკითხები; «он спрашивает» — ეკითხება\nтранскрипция: [к’итхва]").Build();
        var entries = new List<VocabularyEntry> { read, ask };

        for (var attempt = 0; attempt < 50; attempt++)
        {
            var reverse = new QuizCreator().CreateQuizQuestions(entries, entries)
                .Where(q => q.Question.StartsWith("კითხვა"))
                .ToList();

            reverse.Count.ShouldBe(4);
            reverse.Where(q => q.Answer == "читать").ShouldAllBe(q => q.Question == "კითხვა (ვკითხულობ)");
            reverse.Where(q => q.Answer == "спрашивать").ShouldAllBe(q => q.Question == "კითხვა (ვეკითხები)");
            reverse.OfType<QuizQuestionWithVariants>().Single(q => q.Answer == "читать").Variants.ShouldNotContain("спрашивать");
        }
    }

    [Test]
    public void ReverseQuestion_OfAWordThatIsNotAVerb_IsTheWordItself()
    {
        var entry = Create.VocabularyEntry().WithWord("дом").WithDefinition("სახლი").WithAdditionalInfo("транскрипция: [сахли]").Build();

        new QuizCreator().CreateQuizQuestions([entry], [entry]).Where(q => q.Answer == "дом").ShouldAllBe(q => q.Question == "სახლი");
    }

    private static void AssertQuizQuestionOfMasteringLevel(List<QuizQuestion> quizQuestions, int quizQuestionCount, MasteringLevel level)
    {
        quizQuestions
            .Count(question =>
                (question is QuizQuestionWithVariants &&
                 question.VocabularyEntry.GetMasteringLevel() == level) ||
                (question is QuizQuestionWithTypeAnswer &&
                 question.VocabularyEntry.GetMasteringLevel() == level))
            .ShouldBe(quizQuestionCount);
    }

    private List<VocabularyEntry> CreateVocabularyWith(int silverMedals, int goldMedals, int emeralds)
    {
        var vocabularyEntries = new List<VocabularyEntry>();

        for (int i = 0; i < silverMedals; i++)
        {
            vocabularyEntries.Add(Create
                .VocabularyEntry()
                .WithWord(Guid.NewGuid().ToString())
                .WithDefinition(Guid.NewGuid().ToString())
                .WithSilverMedal()
                .Build());
        }
        
        for (int i = 0; i < goldMedals; i++)
        {
            vocabularyEntries.Add(Create
                .VocabularyEntry()
                .WithWord(Guid.NewGuid().ToString())
                .WithDefinition(Guid.NewGuid().ToString())
                .WithGoldMedal()
                .Build());
        }
        
        for (int i = 0; i < emeralds; i++)
        {
            vocabularyEntries.Add(Create
                .VocabularyEntry()
                .WithWord(Guid.NewGuid().ToString())
                .WithDefinition(Guid.NewGuid().ToString())
                .WithEmerald()
                .Build());
        }

        return vocabularyEntries;
    }
}