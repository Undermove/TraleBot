using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

public class VocabularyEntryTests
{
    [TestCase(MasteringLevel.MasteredInForwardDirection, 0,0)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 4,0)]
    [TestCase(null, 4,4)]
    public void GetNextMasteringLevelShouldReturnFor(
        MasteringLevel? expectedMasteringLevel,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = new VocabularyEntry
        {
            SuccessAnswersCount = successAnswersCount,
            SuccessAnswersCountInReverseDirection = successAnswersCountInReverseDirection,
        };

        var result = vocabularyEntry.GetNextMasteringLevel();

        result.ShouldBe(expectedMasteringLevel);
    }

    [TestCase(3, 0,0)]
    [TestCase(1, 2,0)]
    [TestCase(1, 4,2)]
    [TestCase(3, 4,0)]
    [TestCase(3, 0,5)]
    [TestCase(null, 4,4)]
    public void GetScoreToNextLevelShouldReturnFor(
        int? expectedScore,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = new VocabularyEntry
        {
            SuccessAnswersCount = successAnswersCount,
            SuccessAnswersCountInReverseDirection = successAnswersCountInReverseDirection,
        };

        var result = vocabularyEntry.GetScoreToNextLevel();
        
        result.ShouldBe(expectedScore);
    }

    [TestCase("кот", "cat", "кот", 1, 0, 0)]
    [TestCase("cat", "cat", "кот", 0, 1, 0)]
    [TestCase("cat", "кот", "cat", 1, 0, 0)]
    [TestCase("электропривод", "cat", "кот", 0, 0, 1)]
    public void ScorePointShouldReturn(
        string answer,
        string word,
        string definition,
        int successAnswersCount,
        int successAnswersCountInReverseDirection,
        int failedAnswersCount)
    {
        var vocabularyEntry = new VocabularyEntry
        {
            Word = word,
            Definition = definition,
        };

        vocabularyEntry.ScorePoint(answer);
        
        vocabularyEntry.SuccessAnswersCount.ShouldBe(successAnswersCount);
        vocabularyEntry.SuccessAnswersCountInReverseDirection.ShouldBe(successAnswersCountInReverseDirection);
        vocabularyEntry.FailedAnswersCount.ShouldBe(failedAnswersCount);
    }

    [TestCase(MasteringLevel.MasteredInForwardDirection, 3,0)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 3,3)]
    [TestCase(MasteringLevel.MasteredInBothDirections, 4,3)]
    [TestCase(null, 0,3)]
    [TestCase(null, 4,4)]
    public void Test(
        MasteringLevel? expectedMasteringLevel,
        int successAnswersCount,
        int successAnswersCountInReverseDirection)
    {
        var vocabularyEntry = new VocabularyEntry
        {
            SuccessAnswersCount = successAnswersCount,
            SuccessAnswersCountInReverseDirection = successAnswersCountInReverseDirection,
        };

        var result = vocabularyEntry.GetAcquiredLevel();

        result.ShouldBe(expectedMasteringLevel);
    }
}