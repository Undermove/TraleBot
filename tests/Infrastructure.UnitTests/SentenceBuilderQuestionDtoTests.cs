using System.Text.Json;
using System.Text.Json.Serialization;
using Infrastructure.Telegram.Services;
using Shouldly;

namespace Infrastructure.UnitTests;

/// <summary>
/// Unit tests for SentenceBuilderQuestion.AlternativeAnswers field — AC from issue #968.
/// </summary>
public class SentenceBuilderQuestionDtoTests
{
    [Test]
    public void SentenceBuilderQuestion_AlternativeAnswers_NullByDefault_SerializesCorrectly()
    {
        var q = new SentenceBuilderQuestion();

        // Property is nullable and defaults to null
        q.AlternativeAnswers.ShouldBeNull("AlternativeAnswers must default to null");

        // When null, JSON output must omit the field (WhenWritingNull policy)
        var options = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
        var json = JsonSerializer.Serialize(q, options);
        json.Contains("alternativeAnswers").ShouldBeFalse(
            "null AlternativeAnswers must be omitted from JSON when DefaultIgnoreCondition=WhenWritingNull");

        // Non-null value must survive round-trip
        q.AlternativeAnswers = new List<List<string>>
        {
            new() { "მე", "სახლში", "ვარ" },
            new() { "სახლში", "მე", "ვარ" },
        };

        var json2 = JsonSerializer.Serialize(q);
        using var doc = JsonDocument.Parse(json2);

        doc.RootElement.TryGetProperty("alternativeAnswers", out var aa).ShouldBeTrue(
            "alternativeAnswers must appear in JSON when non-null");
        aa.GetArrayLength().ShouldBe(2,
            "alternativeAnswers must contain 2 inner arrays");
        aa[0].GetArrayLength().ShouldBe(3,
            "first alternative answer must contain 3 tokens");
        aa[1][1].GetString().ShouldBe("მე",
            "second alternative[1] must be 'მე' (round-trip)");
    }
}
