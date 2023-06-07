using System.Net;
using System.Text;
using Telegram.Bot.Types;

namespace IntegrationTests;

public class WebhookTests: TestBase
{
    //[Test]
    public async Task HealthCheckEndpoint_Returns200StatusCode()
    {
        // Arrange
        var client = _testServer.CreateClient();    
        
        var requestBody = new
        {
            Token = "your_token",
            Request = new Update
            {
                Id = 1
                // Populate the Update properties as needed
                // ...
            }
        };

        var jsonPayload = System.Text.Json.JsonSerializer.Serialize(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/telegram", content);

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}