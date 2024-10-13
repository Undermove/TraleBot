using System.Text.Json;
using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace Infrastructure.Translation.OpenAiTranslation;

public class OpenAiAzureTranslationService : IAiTranslationService
{
    private readonly ChatClient _chatClient;
    // Формируем JSON-схему с требуемыми полями
    private static readonly BinaryData JsonSchema = BinaryData.FromString(
        """
        {
            "type": "object",
            "properties": {
                "Definition": { "type": "string" },
                "AdditionalTranslations": { "type": "string" },
                "Example": { "type": "string" }
            },
            "required": ["Definition", "AdditionalTranslations", "Example"],
            "additionalProperties": false
        }
        """);

    private static readonly ChatMessage[] StaticChatMessages =
    [
        new SystemChatMessage(
            """
            You are a teacher who helps russian students understand english words. If the user tells you a word in english, you give him
            translation into russian in one word, additional translations and example of usage in english.
            If student give phrase you give him translation into russian and example of usage
            You do not say anything else. Your answer should always starts with 'Definition: ' have 'AdditionalTranslations: ' and ends with 'Example: '
            """),
        new UserChatMessage("Cat"),
        new AssistantChatMessage("Definition: кот; AdditionalTranslations: кошка, кот, кат, гусеничный трактор, блевать, бить плетью; Example: A young cat is a kitten."),
        new UserChatMessage("Pull yourself together"),
        new AssistantChatMessage("Definition: взять себя в руки; AdditionalTranslations:; Example: I know you're very excited about the concert, but you need to pull yourself together."),
        new UserChatMessage("Every cloud has a silver lining"),
        new AssistantChatMessage("Definition: нет худа без добра; AdditionalTranslations:; Example: Even though he had lost the match, he had gained in experience and was now more confident. Every cloud has a silver lining.")
    ];
    
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

        var finalChatMessages = FinalChatMessages(requestWord);


        var response = await _chatClient.CompleteChatAsync(
            finalChatMessages,
            new ChatCompletionOptions
            {
                ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat("translation", JsonSchema, "en", true),
                MaxOutputTokenCount = 300
            }, cancellationToken: ct);
        
        var openAiJsonResponse = JsonSerializer.Deserialize<OpenAiJsonResponse>(response.Value.Content[0].Text);

        if (openAiJsonResponse == null)
        {
            return new TranslationResult.Failure();
        }
        
        return new TranslationResult.Success(openAiJsonResponse.Definition, openAiJsonResponse.AdditionalTranslations, openAiJsonResponse.Example);
    }

    private static ChatMessage[] FinalChatMessages(string? requestWord)
    {
        var finalChatMessages = new ChatMessage[StaticChatMessages.Length + 1];
        
        var span = finalChatMessages.AsSpan();
        StaticChatMessages.AsSpan().CopyTo(span);
        
        span[StaticChatMessages.Length] = new UserChatMessage(requestWord);
        return finalChatMessages;
    }

    private record OpenAiJsonResponse(string Definition, string AdditionalTranslations, string Example);
}