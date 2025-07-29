using Telegram.Bot.Types;
using Domain.Entities;

namespace IntegrationTests.DSL;

public static class Create
{
	public static Update StartCommand()
	{
		return new Update
		{
			Id = 1,
			Message = new Message
			{
				MessageId = 1,
				Date = DateTime.UtcNow,
				Chat = new Chat
				{
					Id = 1,
					Type = Telegram.Bot.Types.Enums.ChatType.Private,
					FirstName = "TraleUser"
				},
				From = new Telegram.Bot.Types.User
				{
					Id = 1,
					IsBot = false,
					FirstName = "TraleUser"
				},
				Text = "/start"
			}
		};
	}

	public static Domain.Entities.User User(long telegramId, string firstName)
	{
		return new()
		{
			TelegramId = telegramId,
			AccountType = UserAccountType.Free,
			RegisteredAtUtc = DateTime.UtcNow,
			InitialLanguageSet = true,
			IsActive = true
		};
	}

	public static Update TelegramUpdate(int updateId, long userTelegramId, string text = "/start")
	{
		return new()
		{
			Id = updateId,
			Message = new Message
			{
				MessageId = 1,
				Date = DateTime.UtcNow,
				Chat = new Chat
				{
					Id = userTelegramId,
					Type = Telegram.Bot.Types.Enums.ChatType.Private,
					FirstName = "Test"
				},
				From = new Telegram.Bot.Types.User
				{
					Id = userTelegramId,
					IsBot = false,
					FirstName = "Test"
				},
				Text = text
			}
		};
	}
}