using System.Net;
using System.Text.Json;
using FluentAssertions;
using Trale.MiniApp;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Catches the class of bugs where a module advertises N lessons in the catalog or
/// <see cref="ModuleRegistry"/> but the /questions endpoint returns 404/empty for
/// one of them — which is exactly what hid broken alphabet-progressive lessons 8-10
/// behind a short-circuiting special case in the controller.
/// </summary>
public class MiniAppLessonQuestionsCoverageTests : TestBase
{
    private static IEnumerable<TestCaseData> AllRegistryLessons()
    {
        foreach (var moduleId in ModuleRegistry.AllModuleIds)
        {
            var def = ModuleRegistry.Get(moduleId)!;
            for (var lessonId = 1; lessonId <= def.MaxLessons; lessonId++)
            {
                yield return new TestCaseData(moduleId, lessonId)
                    .SetName($"Questions_Return200WithNonEmptyList_{moduleId}_lesson{lessonId}");
            }
        }
    }

    [TestCaseSource(nameof(AllRegistryLessons))]
    public async Task Every_registry_lesson_returns_non_empty_questions(string moduleId, int lessonId)
    {
        var client = _testServer.CreateClient();

        var response = await client.GetAsync($"/api/miniapp/modules/{moduleId}/lessons/{lessonId}/questions");

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            because: $"module '{moduleId}' declares MaxLessons covering lesson {lessonId}, so the questions endpoint must serve it");

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        doc.RootElement.ValueKind.Should().Be(JsonValueKind.Array,
            because: $"questions endpoint should return a JSON array (module '{moduleId}', lesson {lessonId})");
        doc.RootElement.GetArrayLength().Should().BeGreaterThan(0,
            because: $"module '{moduleId}' lesson {lessonId} must have at least one question");
    }

    [Test]
    public async Task Alphabet_legacy_module_still_serves_all_seven_auto_chunked_lessons()
    {
        // The old "alphabet" module is driven by an in-memory letter generator that chunks
        // the 33 Georgian letters into 5-per-lesson groups → exactly 7 lessons. Guarding
        // against future off-by-one regressions here, separate from the registry-driven
        // "alphabet-progressive" module.
        var client = _testServer.CreateClient();

        for (var lessonId = 1; lessonId <= 7; lessonId++)
        {
            var response = await client.GetAsync($"/api/miniapp/modules/alphabet/lessons/{lessonId}/questions");
            response.StatusCode.Should().Be(HttpStatusCode.OK, because: $"legacy alphabet lesson {lessonId} should exist");

            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            doc.RootElement.GetArrayLength().Should().BeGreaterThan(0);
        }
    }

    [Test]
    public async Task Unknown_module_returns_404()
    {
        var client = _testServer.CreateClient();

        var response = await client.GetAsync("/api/miniapp/modules/does-not-exist/lessons/1/questions");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task Out_of_range_lesson_returns_404()
    {
        var client = _testServer.CreateClient();

        // Pick any registry module and ask for MaxLessons + 1.
        var def = ModuleRegistry.Get(ModuleRegistry.AllModuleIds.First())!;
        var response = await client.GetAsync($"/api/miniapp/modules/{def.Id}/lessons/{def.MaxLessons + 1}/questions");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
