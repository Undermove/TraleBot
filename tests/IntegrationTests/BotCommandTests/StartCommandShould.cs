using System.Net;
using System.Text;
using Application.Common;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.BotCommandTests;

public class StartCommandShould: TestBase
{
    [Test]
    public async Task CreateNewUser()
    {
        var service = _testServer.Services.GetService<ITraleDbContext>();
        // Arrange
        var client = _testServer.CreateClient();    
        
        var requestBody = Create.StartCommand();
        
        var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/telegram/test_token", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}