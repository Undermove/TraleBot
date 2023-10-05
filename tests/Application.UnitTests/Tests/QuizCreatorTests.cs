using Application.Quizzes.Services;
using Application.UnitTests.DSL;
using Domain.Entities;

namespace Application.UnitTests.Tests;

public class QuizCreatorTests
{
    [Test]
    public void WhenUserHasNoWords_ReturnsSpareWords()
    {
        // Arrange
        var quizCreator = new QuizCreator();
        var silverMedalEntry = Create
            .VocabularyEntry()
            .WithWord("cat")
            .WithDefinition("кошка")
            .WithSilverMedal();
        var vocabularyEntries = new List<VocabularyEntry>();
        var quizType = QuizTypes.SmartQuiz;

        // Act
        var quizQuestions = quizCreator.CreateQuizQuestions(vocabularyEntries, quizType);

        // Assert
        Assert.AreEqual(quizQuestions.Count, 10);
    }
}