using Application.Common.Interfaces.TranslationService;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class GlosbeParsingTranslationService : IParsingTranslationService
{
    private readonly IHttpClientFactory _clientFactory;
    
    public GlosbeParsingTranslationService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }
    public async Task<TranslationResult> TranslateAsync(string? requestWord, CancellationToken ct)
    {
        // Make the HTTP GET request to the Google Translate API
        var requestUrl = $"https://glosbe.com/ru/ka/{requestWord}";
        const string searchPattern = "//main//section[1]//div//ul/li[1]//div//div/h3";
        
        var definition = await Definition(ct, requestUrl, searchPattern);
        
        var additionalInfoUrl = $"https://glosbe.com/ka/ru/{definition}/fragment/details?phraseIndex=0&translationPhrase={requestWord}&translationIndex=0&reverse=true";
        const string additionalSearchPattern = "//main//section[1]//div//ul/li[1]//div//div/h3";

        var additionalInfo = await Definition(ct, additionalInfoUrl, additionalSearchPattern);
        //-- возможно просто можно вот такой запрос делать
        // хотя так сделать не выйдет, потому что для формирования строки нужно еще сделать перевод слова
        //https://glosbe.com/ka/ru/ქლიავი/fragment/details?phraseIndex=0&translationPhrase=слива&translationIndex=0&reverse=true
        //https://glosbe.com/ru/ka/книга/fragment/details?phraseIndex=0&translationPhrase=წიგნი&translationIndex=0&reverse=true
        //https://glosbe.com/ru/ka/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0/fragment/details?phraseIndex=0&translationPhrase=%E1%83%AC%E1%83%98%E1%83%92%E1%83%9C%E1%83%98&translationIndex=0&reverse=true
        // слива - ქლიავი это хороший пример слова, которое не содержит примеров применения
        // книга - წიგნი это хороший пример слова, которое содержит примеры применения

        return new TranslationResult(definition,additionalInfo, "", false);
    }

    private async Task<string> Definition(CancellationToken ct, string requestUrl, string searchPattern)
    {
        using var httpClient = _clientFactory.CreateClient();
        var responseContent = await httpClient.GetStringAsync(requestUrl, ct);

        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        var element = htmlDoc.DocumentNode.SelectSingleNode(searchPattern);
        var definition = element.InnerText.Trim('\n');
        return definition;
    }
}