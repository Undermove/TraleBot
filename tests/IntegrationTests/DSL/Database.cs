using Application.Common;
using Domain.Entities;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.DSL;

public static class Database
{
	public static async Task ShouldContainFreeUserAccount(this TraleTestApplication testApplication, long telegramId)
	{
		await using var scope = testApplication.Services.CreateAsyncScope();
		var databaseContext = scope.ServiceProvider.GetService<ITraleDbContext>();
		var user = await databaseContext?.Users.FirstOrDefaultAsync(u => u.TelegramId == telegramId)!;
		user.Should().NotBeNull();
		user!.AccountType.Should().Be(UserAccountType.Free);
	}
}