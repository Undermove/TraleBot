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
        var client = _testServer.CreateClient();    
        
        var requestBody = Create.StartCommand();
        
        var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/telegram/test_token", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        DatabaseContext.Users.Count().Should().Be(1);
        var user = await DatabaseContext.Users.FirstAsync(u => u.TelegramId == requestBody.Message!.From!.Id);
        user.TelegramId.Should().Be(requestBody.Message!.From!.Id);
    }
}