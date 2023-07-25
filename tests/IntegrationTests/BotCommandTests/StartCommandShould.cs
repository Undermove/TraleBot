using System.Net;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;

namespace IntegrationTests.BotCommandTests;

public class StartCommandShould: TestBase
{
    [Test]
    public async Task CreateNewUser_WithFreeAccountType()
    {
        // Arrange
        using var client = _testServer.CreateClient();
        var requestBody = Create.StartCommand();

        // Act
        var response = await client.PostAsync("/telegram/test_token", requestBody.ToJsonContent());

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _testServer.ShouldContainFreeUserAccount(requestBody.Message!.From!.Id);
    }
}