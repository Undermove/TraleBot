using System.Net;

namespace IntegrationTests;

public class HealthCheckIntegrationTests: TestBase
{
    //[Test]
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