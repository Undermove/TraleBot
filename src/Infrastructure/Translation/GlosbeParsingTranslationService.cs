using System.Net;
using System.Text;
using Application.Common.Extensions;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using HtmlAgilityPack;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Translation;

public class GlosbeParsingTranslationService(IHttpClientFactory clientFactory, ILoggerFactory logger)
    : IParsingUniversalTranslator
{
    private readonly ILogger _logger = logger.CreateLogger(typeof(GlosbeParsingTranslationService));

    const string DefinitionSearchPattern = "//main//section[1]//div//ul/li[1]//div//div/h3";
    const string AdditionalSearchPattern = "//p//span";
    private const string ExampleElementsSearchPattern = "//div//div//div//div//div[contains(@class, \"w-1/2\")]";

    public async Task<TranslationResult> TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct)
    {
        var (isTranslated, definition) = await GetDefinition(requestWord, ct);

        if (!isTranslated)
        {
            return new TranslationResult.Failure();
        }
        
        var (additionalInfo, example) = await GetAdditionalInfoAndExampleForDefinition(definition, requestWord, ct);
        
        return new TranslationResult.Success(definition, additionalInfo, example);
    }

    private async Task<(bool isTranslated, string definition)> GetDefinition(string requestWord, CancellationToken ct)
    {
        string languagePrefix = requestWord.DetectLanguage() == Language.Russian ? "ru/ka" : "ka/ru";
        var requestUrl = $"https://glosbe.com/{languagePrefix}/{requestWord}";
        using var httpClient = clientFactory.CreateClient();
        string responseContent;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
            request.Headers.Clear();
            request.Headers.Add("User-Agent", "curl/8.4.0");
            request.Headers.Add("Host", "glosbe.com");
            request.Headers.Add("Accept", "*/*");
            var response = await httpClient.SendAsync(request, ct);
            responseContent = await response.Content.ReadAsStringAsync(ct);
        }
        catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return (false, "");
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Glosbe parsing error");
            return (false, "");
        }
        
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        
        var element = htmlDoc.DocumentNode.SelectSingleNode(DefinitionSearchPattern);
        if (element == null)
        {
            return (false, "");
        }
        var definition = element.InnerText.Trim('\n');
        return (true, definition);
    }
    
    private async Task<(string additionalInfo, string example)> GetAdditionalInfoAndExampleForDefinition(string definition, string requestWord, CancellationToken ct)
    {
        string languagePrefix = requestWord.DetectLanguage() == Language.Russian ? "ka/ru" : "ru/ka";
        var additionalInfoUrl = $"https://glosbe.com/{languagePrefix}/{definition}/fragment/details?phraseIndex=0&translationPhrase={requestWord}&translationIndex=0&reverse=true";

        using var httpClient = clientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, additionalInfoUrl);
        request.Headers.Clear();
        request.Headers.Add("User-Agent", "curl/8.4.0");
        request.Headers.Add("Host", "glosbe.com");
        request.Headers.Add("Accept", "*/*");
        var response = await httpClient.SendAsync(request, ct);
        var responseContent = await response.Content.ReadAsStringAsync(ct);

        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        
        var additionalInfoElements = htmlDoc.DocumentNode.SelectNodes(AdditionalSearchPattern);
        var stringBuilder = new StringBuilder();
        var additionalInfoValues = additionalInfoElements?.Select(node => node.InnerText).ToArray() ?? Array.Empty<string>();
        var additionalInfo = stringBuilder.AppendJoin(", ", additionalInfoValues).ToString();
        
        var exampleElements = htmlDoc.DocumentNode.SelectNodes(ExampleElementsSearchPattern);
        var exampleValues = exampleElements?.Select(node => node.InnerText).ToArray() ?? Array.Empty<string>();
        var exampleIndex = requestWord.DetectLanguage() == Language.Russian ? 0 : 1;
        var example = exampleValues.Length > 0  ? exampleValues[exampleIndex].Trim() : "";
        return (additionalInfo, example);
    }
}