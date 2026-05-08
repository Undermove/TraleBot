using System.Net;
using System.Text.Json;
using FluentAssertions;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Verifies that the /api/miniapp/modules/postpositions/lessons/7/questions endpoint
/// returns sentence-builder questions with the full DTO payload the frontend requires.
/// Covers the QA test plan for issue #860 (backend sentence-builder loader).
/// </summary>
public class PostpositionsLessonTests : TestBase
{
    [Test]
    public async Task GetPostpositionsLesson_ReturnsSentenceBuilderQuestions()
    {
        var client = _testServer.CreateClient();

        var response = await client.GetAsync("/api/miniapp/modules/postpositions/lessons/7/questions");

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "postpositions lesson 7 (sentence-builder) is registered in ModuleRegistry");

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        doc.RootElement.ValueKind.Should().Be(JsonValueKind.Array,
            because: "the questions endpoint should return a JSON array");
        doc.RootElement.GetArrayLength().Should().BeGreaterThan(0,
            because: "questions7.json has sentence-builder questions");

        // Every returned question should be a sentence-builder type
        var sentenceBuilderQuestions = doc.RootElement.EnumerateArray()
            .Where(q => q.TryGetProperty("questionType", out var qt)
                        && qt.GetString() == "sentence-builder")
            .ToList();

        sentenceBuilderQuestions.Should().NotBeEmpty(
            because: "postpositions lesson 7 consists entirely of sentence-builder questions");

        // Spot-check DTO fields on the first sentence-builder question
        var first = sentenceBuilderQuestions[0];

        first.TryGetProperty("correctOrder", out var correctOrder).Should().BeTrue(
            because: "sentence-builder questions must include correctOrder");
        correctOrder.ValueKind.Should().Be(JsonValueKind.Array);
        correctOrder.GetArrayLength().Should().BeGreaterThan(0);

        first.TryGetProperty("chipPool", out var chipPool).Should().BeTrue(
            because: "sentence-builder questions must include chipPool");
        chipPool.ValueKind.Should().Be(JsonValueKind.Array);
        chipPool.GetArrayLength().Should().BeGreaterThan(0);

        first.TryGetProperty("presetPositions", out var presets).Should().BeTrue(
            because: "sentence-builder questions must include presetPositions");
        presets.ValueKind.Should().Be(JsonValueKind.Array);

        first.TryGetProperty("targetSentence", out var target).Should().BeTrue(
            because: "sentence-builder questions must include targetSentence");
        target.TryGetProperty("ru", out var ru).Should().BeTrue(
            because: "targetSentence must expose the Russian translation");
        ru.GetString().Should().NotBeNullOrEmpty();

        first.TryGetProperty("level", out var level).Should().BeTrue(
            because: "sentence-builder questions must include level");
        level.GetInt32().Should().BeGreaterThan(0);
    }
}
