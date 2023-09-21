using IntegrationTests.Fakes;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot;
using Testcontainers.PostgreSql;

namespace IntegrationTests;

public class TestBase
{
    protected TraleTestApplication _testServer = null!;
    private PostgreSqlContainer _postgresqlContainer = null!;

    protected TelegramClientFake TelegramClientFake { get; private set; } = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        // Start PostgreSQL container
        _postgresqlContainer = new PostgreSqlBuilder()
            .WithCleanUp(true)
            .Build();

        await _postgresqlContainer.StartAsync();

        // Build and start TestHost
        _testServer = new TraleTestApplication(_postgresqlContainer.GetConnectionString());
        TelegramClientFake = _testServer.Services.GetService<ITelegramBotClient>() as TelegramClientFake ??
                             throw new InvalidOperationException();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _testServer.DisposeAsync();
        await _postgresqlContainer.StopAsync();
    }
}