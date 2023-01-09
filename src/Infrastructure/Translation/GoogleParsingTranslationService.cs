using Application.Common.Interfaces;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class GoogleParsingTranslationService : ITranslationService
{
    public async Task<string> TranslateAsync(string requestWord, CancellationToken ct)
    {
        return "Я пока что не умею переводить, но скоро научусь!";
        // // Make the HTTP GET request to the Google Translate API
        // using var httpClient = new HttpClient();
        // var requestUrl = $"https://translate.google.com/?sl=en&tl=ru&text={requestWord}%0A&op=translate";
        // var response = await httpClient.GetAsync(requestUrl, ct);
        // var responseContent = await response.Content.ReadAsStringAsync(ct);
        //
        // // Load the response HTML into an HtmlDocument
        // var htmlDoc = new HtmlDocument();
        // htmlDoc.LoadHtml(responseContent);
        //
        // // Find the element with the class "ryNqvb"
        // var ryNqvbElement = htmlDoc.DocumentNode.SelectNodes("//*[@class='ryNqvb']");
        // if (ryNqvbElement == null)
        // {
        //     throw new Exception();
        // }
        //
        // // Get the text content of the element
        // var text = ryNqvbElement[0].InnerText;
        // return text;
    }
}