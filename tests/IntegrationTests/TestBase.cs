using Application.Common;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
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
            .WithImage("postgres:16.1")
            .Build();

        await _postgresqlContainer.StartAsync();

        // Build and start TestHost
        _testServer = new TraleTestApplication(_postgresqlContainer.GetConnectionString());
        TelegramClientFake = _testServer.Services.GetService<ITelegramBotClient>() as TelegramClientFake ??
                             throw new InvalidOperationException();

        // Ensure schema is up-to-date — apply EF migrations against the test container.
        // Program.cs does this on real startup, but WebApplicationFactory may skip the
        // initialization scope, so we run it explicitly here.
        using var scope = _testServer.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        await dbContext.Database.MigrateAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _testServer.DisposeAsync();
        await _postgresqlContainer.StopAsync();
        await _postgresqlContainer.DisposeAsync();
    }
}