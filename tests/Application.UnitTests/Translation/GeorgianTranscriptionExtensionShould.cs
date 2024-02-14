using Application.Translation.Languages;
using Shouldly;

namespace Application.UnitTests.Translation;

public class GeorgianTranscriptionExtensionShould
{
    [Test]
    public void ReturnTranscription_WhenGeorgianCharactersPassed()
    {
        // Arrange
        var word = "სახელი";
        var expectedTranscription = "sakheli";

        var result = GeorgianTranscriptionExtension.GetTranscription(word);

        result.ShouldBe(expectedTranscription);
    }
}