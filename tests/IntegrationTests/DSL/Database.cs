using Application.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.DSL;

public static class Database
{
	public static async Task ShouldContainUserWithTelegramId(this TraleTestApplication testApplication, long telegramId)
	{
		await using var scope = testApplication.Services.CreateAsyncScope();
		var databaseContext = scope.ServiceProvider.GetService<ITraleDbContext>();
		var user = await databaseContext?.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId)!;
		user.Should().NotBeNull();
	}
}