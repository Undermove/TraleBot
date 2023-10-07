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
        var vocabularyEntries = CreateVocabularyWith(10,10,10);
        var quizType = QuizTypes.SmartQuiz;

        // Act
        var quizQuestions = quizCreator.CreateQuizQuestions(vocabularyEntries, quizType);

        // Assert
        quizQuestions.Count.ShouldBe(28);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 6, MasteringLevel.NotMastered);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 4, MasteringLevel.MasteredInForwardDirection);
        AssertQuizQuestionOfMasteringLevel(quizQuestions, 4, MasteringLevel.MasteredInBothDirections);
    }

    private static void AssertQuizQuestionOfMasteringLevel(List<QuizQuestion> quizQuestions, int quizQuestionCount, MasteringLevel level)
    {
        quizQuestions
            .Count(question =>
                question is QuizQuestionWithVariants &&
                question.VocabularyEntry.GetMasteringLevel() == level)
            .ShouldBe(quizQuestionCount);
        quizQuestions
            .Count(question =>
                question is QuizQuestionWithTypeAnswer &&
                question.VocabularyEntry.GetMasteringLevel() == level)
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