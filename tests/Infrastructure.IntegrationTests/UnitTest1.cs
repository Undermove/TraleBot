using Application;
using Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Infrastructure.UnitTests;

public class CommandProcessingHandlingTests
{
    [SetUp]
    public void Setup()
    {
        // IServiceCollection collection = new ServiceCollection();
        // var builder = new ConfigurationBuilder();
        // builder.AddJsonFile("appsettings.json", optional: true);
        // var configuration = builder.Build();
        // collection.AddInfrastructure(configuration);
        // collection.AddApplication();
        //
        // IServiceProvider provider = collection.BuildServiceProvider();
        // provider.GetService<IDialogProcessor>();
    }

    [Test]
    public void Test1()
    {
        Assert.Pass();
    }
}