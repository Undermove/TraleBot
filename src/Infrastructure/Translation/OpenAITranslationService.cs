using Application.Common.Interfaces.TranslationService;
using Microsoft.Extensions.Options;
using OpenAI_API;
using OpenAI_API.Chat;
using OpenAI_API.Models;

namespace Infrastructure.Translation;

public class OpenAITranslationService : ITranslationService
{
    private readonly OpenAIAPI _openAIApi;
    
    public OpenAITranslationService(IHttpClientFactory clientFactory, IOptions<OpenAiConfig> config)
    {
        _openAIApi = new OpenAIAPI(config.Value.ApiKey)
        {
            HttpClientFactory = clientFactory
        };
    }
    
    public async Task<TranslationResult> TranslateAsync(string? requestWord, CancellationToken ct)
    {
        var chat = _openAIApi.Chat.CreateConversation(new ChatRequest()
        {
            Model = Model.ChatGPTTurbo
        });

        // give instruction as System
        chat.AppendSystemMessage(
            "You are a teacher who helps russian students understand english words. If the user tells you a word in english, you give him " +
            "translation into russian additional translations and example of usage in english" +
            "If student give phrase you give him translation into russian and example of usage" +
            "You do not say anything else.");

        // give a few examples as user and assistant
        chat.AppendUserInput("Cat");
        chat.AppendExampleChatbotOutput("Definition: кот; AdditionalTranslations: кошка, кот, кат, гусеничный трактор, блевать, бить плетью; Example: A young cat is a kitten.");
        chat.AppendUserInput("Pull yourself together");
        chat.AppendExampleChatbotOutput("Definition: взять себя в руки; Example: I know you're very excited about the concert, but you need to pull yourself together.");

        chat.AppendUserInput(requestWord);
        
        string response = await chat.GetResponseFromChatbotAsync();
        const string DefinitionFieldName = "Definition: ";
        const string AdditionalTranslationsFieldName = "AdditionalTranslations: ";
        const string ExampleFieldName = "Example: ";
        
        var splitResponse = response.Split(";");
        var definition = splitResponse
            .SingleOrDefault(s => s.Contains(DefinitionFieldName))?
            .Replace(DefinitionFieldName, "").Trim() ?? "";
        var additionalInfo = splitResponse
            .SingleOrDefault(s => s.Contains(AdditionalTranslationsFieldName))?
            .Replace(AdditionalTranslationsFieldName, "").Trim() ?? "";
        var example = splitResponse
            .SingleOrDefault(s => s.Contains(ExampleFieldName))?
            .Replace(ExampleFieldName, "").Trim() ?? "";

        return new TranslationResult(definition, additionalInfo, example, true);
    }
}

public class OpenAiConfig
{
    public const string Name = "OpenAiConfiguration"; 
    public string ApiKey { get; set; }
}