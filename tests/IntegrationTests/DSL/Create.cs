using Telegram.Bot.Types;

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
				From = new User
				{
					Id = 1,
					IsBot = false,
					FirstName = "TraleUser"
				},
				Text = "/start"
			}
		};
	}
}