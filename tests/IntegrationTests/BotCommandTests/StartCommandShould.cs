using System.Net;
using System.Text;
using IntegrationTests.DSL;

namespace IntegrationTests.BotCommandTests;

public class StartCommandShould: TestBase
{
    // [Test]
    public async Task CreateNewUser()
    {
        // Arrange
        var client = _testServer.CreateClient();    
        
        var requestBody = Create.StartCommand();
        
        var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/telegram/test_token", content);

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }
}