using Application.Common.Interfaces.TranslationService;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class WooordHuntParsingTranslationService : ITranslationService
{
    private readonly IHttpClientFactory _clientFactory;
    
    public WooordHuntParsingTranslationService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }
    
    public async Task<TranslationResult> TranslateAsync(string? requestWord, CancellationToken ct)
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
        var element = htmlDoc.DocumentNode.SelectSingleNode("(//*[starts-with(@class, 't_inline')])[1]");
        if (element == null)
        {
            return new TranslationResult("","", false);
        }
        
        // Get the text content of the element
        var text = element.InnerText;
        var definition = text.Split(',')[0];
        return new TranslationResult(definition, text, true);
    }
}