using System.Net;
using System.Text.Json;
using FluentAssertions;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Verifies that the verbal-aspect module is correctly positioned in the module catalog
/// returned by GET /api/miniapp/content.
/// Covers the QA test plan for issue #928.
/// </summary>
public class ModuleOrderTests : TestBase
{
    [Test]
    public async Task VerbalAspectModule_AppearsAfterAoristAndBeforeVerbClasses()
    {
        var client = _testServer.CreateClient();

        var response = await client.GetAsync("/api/miniapp/content");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        var modules = doc.RootElement.GetProperty("modules").EnumerateArray()
            .Select((m, i) => (id: m.GetProperty("id").GetString()!, index: i))
            .ToList();

        var aoristIndex = modules.FirstOrDefault(m => m.id == "aorist").index;
        var verbalAspectEntry = modules.FirstOrDefault(m => m.id == "verbal-aspect");
        var futureTenseIndex = modules.FirstOrDefault(m => m.id == "future-tense").index;

        verbalAspectEntry.id.Should().Be("verbal-aspect",
            because: "verbal-aspect module must be present in the catalog");

        verbalAspectEntry.index.Should().BeGreaterThan(aoristIndex,
            because: "verbal-aspect is a synthesis module that should come after aorist");

        verbalAspectEntry.index.Should().BeLessThan(futureTenseIndex,
            because: "verbal-aspect should immediately follow aorist, before future-tense");
    }
}
