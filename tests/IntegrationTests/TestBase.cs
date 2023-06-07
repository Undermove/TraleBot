using Testcontainers.PostgreSql;

namespace IntegrationTests;

public class TestBase
{
    protected TraleTestApplication _testServer = null!;
    private PostgreSqlContainer _postgresqlContainer = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        // Start PostgreSQL container
        _postgresqlContainer = new PostgreSqlBuilder()
            .Build();

        await _postgresqlContainer.StartAsync();

        // Build and start TestHost
        _testServer = new TraleTestApplication(_postgresqlContainer.GetConnectionString());
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _testServer.DisposeAsync();
        await _postgresqlContainer.StopAsync();
    }
}