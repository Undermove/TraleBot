using System.Net;
using System.Text.Json;
using FluentAssertions;
using Trale.MiniApp;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Verifies that the verbal-aspect module appears in the catalog between aorist and verb-classes.
/// Covers issue #928 AC: "Модуль «Вид глагола» виден в списке модулей между модулями Аорист и VerbClasses".
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
            .Select((m, idx) => new { Id = m.GetProperty("id").GetString()!, Index = idx })
            .ToList();

        var aoristIdx = modules.FirstOrDefault(m => m.Id == "aorist")?.Index;
        var verbalAspectIdx = modules.FirstOrDefault(m => m.Id == "verbal-aspect")?.Index;
        var verbClassesIdx = modules.FirstOrDefault(m => m.Id == "verb-classes")?.Index;

        aoristIdx.Should().NotBeNull(because: "aorist module must exist in the catalog");
        verbalAspectIdx.Should().NotBeNull(because: "verbal-aspect module must be registered in the catalog");
        verbClassesIdx.Should().NotBeNull(because: "verb-classes module must exist in the catalog");

        verbalAspectIdx.Should().BeGreaterThan(aoristIdx!.Value,
            because: "verbal-aspect must appear after aorist in the catalog");
        verbalAspectIdx.Should().BeLessThan(verbClassesIdx!.Value,
            because: "verbal-aspect must appear before verb-classes in the catalog");
    }
}
