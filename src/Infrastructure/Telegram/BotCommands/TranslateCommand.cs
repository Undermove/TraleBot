using System.Net.Http.Headers;
using Infrastructure.Telegram.Models;
using PuppeteerSharp;
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
        // Launch a new browser instance and navigate to the webpage
        var fetcher = new BrowserFetcher();
        await fetcher.DownloadAsync(BrowserFetcher.DefaultChromiumRevision);
        var browser = await Puppeteer.LaunchAsync(new LaunchOptions
        {
            Headless = true
        });
        var page = await browser.NewPageAsync();
        await page.GoToAsync($"https://translate.google.com/?sl=en&tl=ru&text={request.Text}%0A&op=translate");

        // Extract the text content of the elements
        var translatedText = await page.QuerySelectorAsync(".ryNqvb");
        var result = await (await translatedText.GetPropertyAsync("innerText")).JsonValueAsync<string>();

        // Close the browser
        await browser.CloseAsync();

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result,
            cancellationToken: token);
    }
}