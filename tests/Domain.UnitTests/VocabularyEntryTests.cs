using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

public class VocabularyEntryTests
{
    [TestCase(MasteringLevel.MasteredInForwardDirection, 0, 0)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 4, 0)]
    [TestCase(null, 4, 4)]
    public void GetNextMasteringLevelShouldReturnFor(
        MasteringLevel? expectedMasteringLevel,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = Create.VocabularyEntry()
            .WithSuccessAnswersCount(successAnswersCount)
            .WithSuccessAnswersCountInReverseDirection(successAnswersCountInReverseDirection)
            .Build();

        var result = vocabularyEntry.GetNextMasteringLevel();

        result.ShouldBe(expectedMasteringLevel);
    }

    [TestCase(3, 0, 0)]
    [TestCase(1, 2, 0)]
    [TestCase(1, 4, 2)]
    [TestCase(3, 4, 0)]
    [TestCase(3, 0, 5)]
    [TestCase(null, 4, 4)]
    public void GetScoreToNextLevelShouldReturnFor(
        int? expectedScore,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = Create.VocabularyEntry()
            .WithSuccessAnswersCount(successAnswersCount)
            .WithSuccessAnswersCountInReverseDirection(successAnswersCountInReverseDirection)
            .Build();

        var result = vocabularyEntry.GetScoreToNextLevel();

        result.ShouldBe(expectedScore);
    }

    [TestCase("кот", "cat", "кот", 0,1, 0, 0)]
    [TestCase("cat", "cat", "кот", 0,0, 0, 0)]
    [TestCase("cat", "cat", "кот", 3,3, 1, 0)]
    [TestCase("cat", "кот", "cat", 0,1, 0, 0)]
    [TestCase("электропривод", "cat", "кот", 0, 0, 0, 1)]
    public void ScorePointShouldReturn(
        string answer,
        string word,
        string definition,
        int initialSuccessAnswersCount,
        int expectedSuccessAnswersCount,
        int expectedSuccessAnswersCountInReverseDirection,
        int expectedFailedAnswersCount)
    {
        var vocabularyEntry = Create.VocabularyEntry()
            .WithWord(word)
            .WithDefinition(definition)
            .WithSuccessAnswersCount(initialSuccessAnswersCount)
            .Build();

        vocabularyEntry.ScorePoint(answer);

        vocabularyEntry.SuccessAnswersCount.ShouldBe(expectedSuccessAnswersCount);
        vocabularyEntry.SuccessAnswersCountInReverseDirection.ShouldBe(expectedSuccessAnswersCountInReverseDirection);
        vocabularyEntry.FailedAnswersCount.ShouldBe(expectedFailedAnswersCount);
    }

    [TestCase(MasteringLevel.MasteredInForwardDirection, 3, 0)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 3, 3)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 4, 3)]
    [TestCase(null, 3, 4)]
    [TestCase(null, 0, 3)]
    [TestCase(null, 4, 4)]
    public void GetAcquiredLevelShouldReturn(
        MasteringLevel? expectedMasteringLevel,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = Create.VocabularyEntry()
            .WithSuccessAnswersCount(successAnswersCount)
            .WithSuccessAnswersCountInReverseDirection(successAnswersCountInReverseDirection)
            .Build();

        var result = vocabularyEntry.GetAcquiredLevel();

        result.ShouldBe(expectedMasteringLevel);
    }

    [TestCase(MasteringLevel.NotMastered, 0, 0)]
    [TestCase(MasteringLevel.NotMastered, 2, 4)]
    [TestCase(MasteringLevel.MasteredInForwardDirection, 4, 2)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 4, 4)]
    [TestCase(MasteringLevel.NotMastered, 0, 4)]
    public void GetMasteringShouldReturn(
        MasteringLevel expectedMasteringLevel,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = Create.VocabularyEntry()
            .WithSuccessAnswersCount(successAnswersCount)
            .WithSuccessAnswersCountInReverseDirection(successAnswersCountInReverseDirection)
            .Build();

        var result = vocabularyEntry.GetMasteringLevel();

        result.ShouldBe(expectedMasteringLevel);
    }
}