using Application.Translation.Languages;
using Shouldly;

namespace Application.UnitTests.Translation;

public class GeorgianTranscriptionExtensionShould
{
    [TestCase("სახელი", "sakheli")]
    [TestCase("ჩემით", "chemit")]
    [TestCase("მოდი ვნახოთ", "modi vnakhot")]
    public void ReturnTranscription_WhenGeorgianCharactersPassed(string word, string expectedTranscription)
    {
        // Arrange
        var result = GeorgianTranscriptionExtension.GetTranscription(word);

        result.ShouldBe(expectedTranscription);
    }
}