using Application.Common.Interfaces;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class WooordHuntParsingTranslationService : ITranslationService
{
    private readonly IHttpClientFactory _clientFactory;
    
    public WooordHuntParsingTranslationService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }
    public async Task<string> TranslateAsync(string requestWord, CancellationToken ct)
    {
        // Make the HTTP GET request to the Google Translate API
        using var httpClient = _clientFactory.CreateClient();
        var requestUrl = $"https://wooordhunt.ru/word/{requestWord}";
        var response = await httpClient.GetAsync(requestUrl, ct);
        var responseContent = await response.Content.ReadAsStringAsync(ct);
        
        // Load the response HTML into an HtmlDocument
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        
        // Find the element with the class "t_inline_en"
        var element = htmlDoc.DocumentNode.SelectSingleNode("//*[@class='t_inline_en']");
        if (element == null)
        {
            throw new Exception();
        }
        
        // Get the text content of the element
        var text = element.InnerText;
        var result = text.Split(',')[0];
        return result;
    }
}