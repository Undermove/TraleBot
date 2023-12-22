using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.Extensions.Options;
using OpenAI_API;
using OpenAI_API.Chat;
using OpenAI_API.Models;

namespace Infrastructure.Translation.OpenAiTranslation;

public class OpenAiTranslationService(IHttpClientFactory clientFactory, IOptions<OpenAiConfig> config)
    : IAiTranslationService
{
    private readonly OpenAIAPI _openAiApi = new(config.Value.ApiKey)
    {
        HttpClientFactory = clientFactory
    };

    public async Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct)
    {
        if (requestWord is { Length: > 40 })
        {
            return new TranslationResult.PromptLengthExceeded();
        }
        
        var chat = _openAiApi.Chat.CreateConversation(new ChatRequest
        {
            Model = Model.ChatGPTTurbo
        });

        // give instruction as System
        chat.AppendSystemMessage(
            "You are a teacher who helps russian students understand english words. If the user tells you a word in english, you give him " +
            "translation into russian in one word, additional translations and example of usage in english" +
            "If student give phrase you give him translation into russian and example of usage" +
            "You do not say anything else.");

        // give a few examples as user and assistant
        chat.AppendUserInput("Cat");
        chat.AppendExampleChatbotOutput("Definition: кот; AdditionalTranslations: кошка, кот, кат, гусеничный трактор, блевать, бить плетью; Example: A young cat is a kitten.");
        chat.AppendUserInput("Pull yourself together");
        chat.AppendExampleChatbotOutput("Definition: взять себя в руки; Example: I know you're very excited about the concert, but you need to pull yourself together.");
        chat.AppendUserInput("Every cloud has a silver lining");
        chat.AppendExampleChatbotOutput("Definition: нет худа без добра; Example: Even though he had lost the match, he had gained in experience and was now more confident. Every cloud has a silver lining.");
        
        chat.AppendUserInput(requestWord);
        
        string response = await chat.GetResponseFromChatbotAsync();
        const string definitionFieldName = "Definition: ";
        const string AdditionalTranslationsFieldName = "AdditionalTranslations: ";
        const string ExampleFieldName = "Example: ";
        
        var splitResponse = response.Split(";");

        if (!splitResponse.Any(s => s.Contains(definitionFieldName)))
        {
            return new TranslationResult.Failure();
        }
        
        var definition = GetField(splitResponse, definitionFieldName);
        var additionalInfo = GetField(splitResponse, AdditionalTranslationsFieldName);
        var example = GetField(splitResponse, ExampleFieldName);

        return new TranslationResult.Success(definition, additionalInfo, example);
    }

    private static string GetField(string[] splitResponse, string fieldName)
    {
        return splitResponse
            .SingleOrDefault(s => s.Contains(fieldName))?
            .Replace(fieldName, "").Trim() ?? "";
    }
}