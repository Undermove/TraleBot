using Application.Common.Interfaces.TranslationService;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class ContextReversoParsingParsingTranslationService(IHttpClientFactory clientFactory)
    : IParsingTranslationService
{
    public async Task<TranslationResult> TranslateAsync(string? requestWord, CancellationToken ct)
    {
        // Make the HTTP GET request to the Google Translate API
        using var httpClient = clientFactory.CreateClient();
        var requestUrl = $"https://context.reverso.net/translation/english-russian/{requestWord}/#-";
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36");
        httpClient.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9");
        httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
        httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        var response = await httpClient.GetAsync(requestUrl, ct);
        var responseContent = await response.Content.ReadAsStringAsync(ct);
        
        // Load the response HTML into an HtmlDocument
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        
        // Find the element with the class "t_inline_en"
        var element = htmlDoc.DocumentNode.SelectNodes("//*[contains(@class, 'translation ltr dict n')]//span[@class='display-term']");
        if (element == null)
        {
            return new TranslationResult.Failure();
        }
        
        // Get the text content of the element
        var definition = element[0].InnerText;
        var additionalInfo = String.Join(", ", element.Select(node => node.InnerText));
        return new TranslationResult.Success(definition, additionalInfo, "");
    }
}