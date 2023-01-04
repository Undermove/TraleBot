using Application.Common.Interfaces;
using PuppeteerSharp;

namespace Infrastructure.Translation;

public class GoogleTranslationService : ITranslationService
{
    public GoogleTranslationService()
    {
    }

    public async Task<string> TranslateAsync(string requestWord, CancellationToken ct)
    {
        await FetchBrowserIfRequired();
        
        // Launch a new browser instance and navigate to the webpage
        var browser = await Puppeteer.LaunchAsync(new LaunchOptions
        {
            Headless = true,
        });
        var page = await browser.NewPageAsync();
        await page.GoToAsync($"https://translate.google.com/?sl=en&tl=ru&text={requestWord}%0A&op=translate");

        // Extract the text content of the elements
        const string nameOfSpanClassWithTranslationResult = "ryNqvb"; // could be changed by Google at any moment!!!
        await page.WaitForXPathAsync($"//*[contains(@class, '{nameOfSpanClassWithTranslationResult}')]");
        var translatedText = await page.QuerySelectorAsync($".{nameOfSpanClassWithTranslationResult}");
        if (translatedText == null)
        {
            throw new ApplicationException("Can't find elememt with class name ");
        }
        
        var propertyAsync = await translatedText.GetPropertyAsync("innerText");
        if (propertyAsync == null)
        {
            throw new ApplicationException("Can't find innerText property in element");
        }
        var result = await propertyAsync.JsonValueAsync<string>();

        // Close the browser
        await browser.CloseAsync();

        return result;
    }
    
    private async Task FetchBrowserIfRequired()
    {
        var fetcher = new BrowserFetcher();
        var revisionInfo = await fetcher.GetRevisionInfoAsync();
        var isAvailable = revisionInfo.Local;
        if (!isAvailable)
        {
            await fetcher.DownloadAsync(BrowserFetcher.DefaultChromiumRevision);
        }
    }
}