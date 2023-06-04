using System.Net;

namespace IntegrationTests;

public class HealthCheckIntegrationTests
{
    private TraleTestApplication _testServer = null!;
    //private PostgreSqlContainer _postgresqlContainer = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        // Start PostgreSQL container
        //_postgresqlContainer = new PostgreSqlBuilder()
          //  .Build();

        //await _postgresqlContainer.StartAsync();

        // Build and start TestHost
        _testServer = new TraleTestApplication();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _testServer.DisposeAsync();
        //await _postgresqlContainer.StopAsync();
    }

    [Test]
    public async Task HealthCheckEndpoint_Returns200StatusCode()
    {
        // Arrange
        var client = _testServer.CreateClient();

        // Act
        var response = await client.GetAsync("/healthz");

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}