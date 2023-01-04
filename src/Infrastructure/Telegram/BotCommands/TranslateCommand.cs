using Infrastructure.Telegram.Models;
using PuppeteerSharp;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public TranslateCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var fetcher = new BrowserFetcher();
        var revisionInfo = await fetcher.GetRevisionInfoAsync();
        var isAvailable = revisionInfo.Local;
        if (!isAvailable)
        {
            await fetcher.DownloadAsync(BrowserFetcher.DefaultChromiumRevision);
        }

        // Launch a new browser instance and navigate to the webpage
        var browser = await Puppeteer.LaunchAsync(new LaunchOptions
        {
            Headless = true
        });
        var page = await browser.NewPageAsync();
        await page.GoToAsync($"https://translate.google.com/?sl=en&tl=ru&text={request.Text}%0A&op=translate");

        // Extract the text content of the elements
        await page.WaitForXPathAsync("//*[contains(@class, 'ryNqvb')]");
        var translatedText = await page.QuerySelectorAsync(".ryNqvb");
        if (translatedText == null)
        {
            await page.ScreenshotAsync("emergency_screenshot.jpg");
            return;
        }
        
        var propertyAsync = await translatedText.GetPropertyAsync("innerText");
        if (propertyAsync == null)
        {
            return;
        }
        var result = await propertyAsync.JsonValueAsync<string>();

        // Close the browser
        await browser.CloseAsync();

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result,
            cancellationToken: token);
    }
}