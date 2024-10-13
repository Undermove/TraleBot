using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace Infrastructure.Translation.OpenAiTranslation;

public class OpenAiAzureTranslationService : IAiTranslationService
{
    private readonly ChatClient _chatClient;
    public OpenAiAzureTranslationService(IOptions<OpenAiConfig> config)
    {
        var openAiClient = new OpenAIClient(config.Value.ApiKey);
        _chatClient = openAiClient.GetChatClient("gpt-4o-mini");
    }
    

    public async Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct)
    {
        if (requestWord is { Length: > 40 })
        {
            return new TranslationResult.PromptLengthExceeded();
        }
        
        ChatMessage[] chatMessages = [
            new SystemChatMessage(
                "You are a teacher who helps russian students understand english words. If the user tells you a word in english, you give him " +
                "translation into russian in one word, additional translations and example of usage in english" +
                "If student give phrase you give him translation into russian and example of usage" +
                "You do not say anything else. Your answer should always starts with 'Definition: ' have 'AdditionalTranslations: ' and ends with 'Example: '"),
            new UserChatMessage("Cat"),
            new AssistantChatMessage("Definition: кот; AdditionalTranslations: кошка, кот, кат, гусеничный трактор, блевать, бить плетью; Example: A young cat is a kitten."),
            new UserChatMessage("Pull yourself together"),
            new AssistantChatMessage("Definition: взять себя в руки; AdditionalTranslations:; Example: I know you're very excited about the concert, but you need to pull yourself together."),
            new UserChatMessage("Every cloud has a silver lining"),
            new AssistantChatMessage("Definition: нет худа без добра; AdditionalTranslations:; Example: Even though he had lost the match, he had gained in experience and was now more confident. Every cloud has a silver lining."),
            new UserChatMessage(requestWord)
        ];

        var response = await _chatClient.CompleteChatAsync(chatMessages, cancellationToken: ct);
        
        const string definitionFieldName = "Definition: ";
        const string additionalTranslationsFieldName = "AdditionalTranslations: ";
        const string exampleFieldName = "Example: ";
        
        var splitResponse = response.Value.Content[0].Text.Split(";");

        if (!splitResponse.Any(s => s.Contains(definitionFieldName)))
        {
            return new TranslationResult.Failure();
        }
        
        var definition = GetField(splitResponse, definitionFieldName);
        var additionalInfo = GetField(splitResponse, additionalTranslationsFieldName);
        var example = GetField(splitResponse, exampleFieldName);

        return new TranslationResult.Success(definition, additionalInfo, example);
    }

    private static string GetField(string[] splitResponse, string fieldName)
    {
        return splitResponse
            .SingleOrDefault(s => s.Contains(fieldName))?
            .Replace(fieldName, "").Trim() ?? "";
    }
}