using System.Net;
using System.Text;
using Application.Common;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.BotCommandTests;

public class StartCommandShould: TestBase
{
    [Test]
    public async Task CreateNewUser()
    {
        // Arrange
        using var client = _testServer.CreateClient();    
        
        var requestBody = Create.StartCommand();
        
        var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/telegram/test_token", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _testServer.ShouldContainUserWithTelegramId(requestBody.Message!.From!.Id);
    }
}