using System.Text;
using Telegram.Bot.Types;

namespace IntegrationTests.Extensions;

public static class JsonExtensions
{
	public static StringContent ToJsonContent(this Update update)
	{
		
		var jsonPayload = Newtonsoft.Json.JsonConvert.SerializeObject(update);
		var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
		return content;
	}
}