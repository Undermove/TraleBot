using Application.Common;
using IntegrationTests.Fakes;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot;

namespace IntegrationTests;

public class TestBase
{
    protected TraleTestApplication _testServer = null!;
    private string _connectionString = null!;

    protected TelegramClientFake TelegramClientFake { get; private set; } = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        // A fresh, already migrated database of the fixture's own on the run's one Postgres (see TestDatabase).
        _connectionString = await TestDatabase.CreateAsync();
        _testServer = new TraleTestApplication(_connectionString);
        TelegramClientFake = _testServer.Services.GetService<ITelegramBotClient>() as TelegramClientFake ??
                             throw new InvalidOperationException();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _testServer.DisposeAsync();
        await TestDatabase.DropAsync(_connectionString);
    }
}
