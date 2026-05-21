using FluentAssertions;
using Trale.MiniApp;

namespace IntegrationTests.Modules;

/// <summary>
/// Unit-level assertions on the static ModuleRegistry.
/// Placed in IntegrationTests (not Application.UnitTests) because ModuleRegistry
/// lives in the Trale web-project, which Application.UnitTests does not reference.
/// Covers issue #928 AC: "MaxLessons = 1 в ModuleRegistry".
/// </summary>
public class ModuleRegistryTests
{
    [Test]
    public void VerbalAspectModule_MaxLessons_IsOne()
    {
        var def = ModuleRegistry.Get("verbal-aspect");

        def.Should().NotBeNull(because: "verbal-aspect must be registered in ModuleRegistry");
        def!.MaxLessons.Should().Be(1, because: "verbal-aspect is a single theory+practice lesson");
    }

    [Test]
    public void VerbalAspectModule_IsRegistered_WithCorrectId()
    {
        var def = ModuleRegistry.Get("verbal-aspect");

        def.Should().NotBeNull();
        def!.Id.Should().Be("verbal-aspect");
    }
}
