using System.Text;
using Application.Common.Extensions;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using HtmlAgilityPack;

namespace Infrastructure.Translation;

public class GlosbeParsingTranslationService : IParsingUniversalTranslator
{
    private readonly IHttpClientFactory _clientFactory;
    const string DefinitionSearchPattern = "//main//section[1]//div//ul/li[1]//div//div/h3";
    const string AdditionalSearchPattern = "//p//span";
    private const string ExampleElementsSearchPattern = "//div//div//div//div//div[contains(@class, \"w-1/2\")]";
    
    public GlosbeParsingTranslationService(IHttpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }
    
    public async Task<TranslationResult> TranslateAsync(string requestWord, Language targetLanguage, CancellationToken ct)
    {
        var definition = await GetDefinition(requestWord, ct);
        var (additionalInfo, example) = await GetAdditionalInfoAndExampleForDefinition(definition, requestWord, ct);
        
        return new TranslationResult(definition, additionalInfo, example, true);
    }

    private async Task<string> GetDefinition(string requestWord, CancellationToken ct)
    {
        string languagePrefix = requestWord.DetectLanguage() == Language.Russian ? "ru/ka" : "ka/ru";
        var requestUrl = $"https://glosbe.com/{languagePrefix}/{requestWord}";
        using var httpClient = _clientFactory.CreateClient();
        var responseContent = await httpClient.GetStringAsync(requestUrl, ct);
        
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(responseContent);
        
        var element = htmlDoc.DocumentNode.SelectSingleNode(DefinitionSearchPattern);
        var definition = element.InnerText.Trim('\n');
        return definition;
    }
    
    private async Task<(string additionalInfo, string example)> GetAdditionalInfoAndExampleForDefinition(string definition, string requestWord, CancellationToken ct)
    {
        string languagePrefix = requestWord.DetectLanguage() == Language.Russian ? "ka/ru" : "ru/ka";
        var additionalInfoUrl = $"https://glosbe.com/{languagePrefix}/{definition}/fragment/details?phraseIndex=0&translationPhrase={requestWord}&translationIndex=0&reverse=true";

        using var httpClient = _clientFactory.CreateClient();
        var responseContent = await httpClient.GetStringAsync(additionalInfoUrl, ct);

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