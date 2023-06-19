using System.Net;
using System.Text;
using Telegram.Bot.Types;

namespace IntegrationTests;

public class WebhookTests: TestBase
{
    //[Test]
    public async Task StartCommand_ResponseShouldContainText()
    {
        // Arrange
        var client = _testServer.CreateClient();    
        
        var requestBody = new Update
        {
            Id = 1
        };
        
        var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync($"/telegram/test_token", content);

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}