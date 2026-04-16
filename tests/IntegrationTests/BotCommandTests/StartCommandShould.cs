using System.Net;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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

    [Test]
    public async Task CreateNewUser_WithGeorgianLanguageAndInitialLanguageSet()
    {
        // Arrange
        using var client = _testServer.CreateClient();
        var requestBody = Create.TelegramUpdate(updateId: 999, userTelegramId: 777773);

        // Act
        var response = await client.PostAsync("/telegram/test_token", requestBody.ToJsonContent());

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = await db.Users
            .Include(u => u.Settings)
            .FirstOrDefaultAsync(u => u.TelegramId == 777773);
        user.Should().NotBeNull();
        user!.InitialLanguageSet.Should().BeTrue();
        user.Settings.CurrentLanguage.Should().Be(Language.Georgian);
    }
}