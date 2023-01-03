using System.Text;
using Infrastructure.Telegram.Models;
using Newtonsoft.Json;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly HttpClient _httpClient;
    private readonly TelegramBotClient _client;

    public TranslateCommand(TelegramBotClient client, IHttpClientFactory httpClientFactory)
    {
        _client = client;
        _httpClient = httpClientFactory.CreateClient("translationapi");
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        // Replace YOUR_API_KEY with your actual API key
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer YOUR_API_KEY");
        _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json; charset=utf-8");

        // Replace en with the desired target language code
        var uri = "https://translation.googleapis.com/v3/projects/project-id/locations/global/translateText";

        var body = new
        {
            sourceLanguageCode = "auto",
            targetLanguageCode = "en",
            contents = new[] { request.Text }
        };

        var content = new StringContent(JsonConvert.SerializeObject(body), Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(uri, content, token);
        var result = await response.Content.ReadAsStringAsync(token);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result,
            cancellationToken: token);
    }
}