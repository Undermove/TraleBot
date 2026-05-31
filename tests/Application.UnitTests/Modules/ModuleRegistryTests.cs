using Trale.MiniApp;

namespace Application.UnitTests.Modules;

[TestFixture]
public class ModuleRegistryTests
{
    [Test]
    public void VerbalAspectModule_MaxLessons_IsOne()
    {
        var def = ModuleRegistry.Get("verbal-aspect");

        Assert.That(def, Is.Not.Null, "verbal-aspect must be registered in ModuleRegistry");
        Assert.That(def!.MaxLessons, Is.EqualTo(1));
    }

    [Test]
    public void VerbalAspectModule_HasCorrectDirectory()
    {
        var def = ModuleRegistry.Get("verbal-aspect");

        Assert.That(def, Is.Not.Null);
        Assert.That(def!.Directory, Is.EqualTo("Lessons/GeorgianVerbalAspect"));
    }
}
