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
        using var httpClient = _clientFactory.CreateClient();
        var requestUrl = $"https://glosbe.com/ru/ka/{requestWord}";
        var responseContent = await httpClient.GetStringAsync(requestUrl, ct);
        
        //-- возможно просто можно вот такой запрос делать
        // хотя так сделать не выйдет, потому что для формирования строки нужно еще сделать перевод слова
        //https://glosbe.com/ka/ru/ქლიავი/fragment/details?phraseIndex=0&translationPhrase=слива&translationIndex=0&reverse=true
        //https://glosbe.com/ru/ka/книга/fragment/details?phraseIndex=0&translationPhrase=წიგნი&translationIndex=0&reverse=true
        // слива - ქლიავი это хороший пример слова, которое не содержит примеров применения
        // книга - წიგნი это хороший пример слова, которое содержит примеры применения
        // Load the response HTML into an HtmlDocument
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);

        return new TranslationResult("","", "", false);
    }
}