using Application.Translation.Languages;
using Shouldly;

namespace Application.UnitTests.Translation;

public class GeorgianTranscriptionExtensionShould
{
    [TestCase("სახელი", "сахэли")]
    [TestCase("ჩემით", "чэмит")]
    [TestCase("მოდი ვნახოთ", "моди внахот")]
    public void ReturnTranscription_WhenGeorgianCharactersPassed(string word, string expectedTranscription)
    {
        // Arrange
        var result = GeorgianTranscriptionExtension.GetTranscription(word);

        result.ShouldBe(expectedTranscription);
    }
}