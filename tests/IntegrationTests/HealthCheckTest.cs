using System.Net;
using FluentAssertions;

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
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}