using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.UnitTests;

public class CommandProcessingHandlingTests
{
    [SetUp]
    public void Setup()
    {
        IServiceCollection collection = new ServiceCollection();
        
        // collection.AddInfrastructure(new ConfigurationSection(new BotConfiguration(), ""));
    }

    [Test]
    public void Test1()
    {
        Assert.Pass();
    }
}