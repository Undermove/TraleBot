using Application.Common.Interfaces.TranslationService;
using Azure.AI.OpenAI;
using Domain.Entities;
using Microsoft.Extensions.Options;

namespace Infrastructure.Translation.OpenAiTranslation;

public class OpenAiAzureTranslationService(IOptions<OpenAiConfig> config) : IAiTranslationService
{
    private readonly OpenAIClient _client = new(config.Value.ApiKey);

    public async Task<TranslationResult> TranslateAsync(string? requestWord, Language language, CancellationToken ct)
    {
        if (requestWord is { Length: > 40 })
        {
            return new TranslationResult.PromptLengthExceeded();
        }

        var options = new ChatCompletionsOptions
        {
            DeploymentName = "gpt-3.5-turbo",
            Messages =
            {
                new ChatRequestSystemMessage(
                    "You are a teacher who helps russian students understand english words. If the user tells you a word in english, you give him " +
                    "translation into russian in one word, additional translations and example of usage in english" +
                    "If student give phrase you give him translation into russian and example of usage" +
                    "You do not say anything else. Your answer should always starts with 'Definition: ' have 'AdditionalTranslations: ' and ends with 'Example: '"),
                new ChatRequestUserMessage("Cat"),
                new ChatRequestAssistantMessage("Definition: кот; AdditionalTranslations: кошка, кот, кат, гусеничный трактор, блевать, бить плетью; Example: A young cat is a kitten."),
                new ChatRequestUserMessage("Pull yourself together"),
                new ChatRequestAssistantMessage("Definition: взять себя в руки; AdditionalTranslations:; Example: I know you're very excited about the concert, but you need to pull yourself together."),
                new ChatRequestUserMessage("Every cloud has a silver lining"),
                new ChatRequestAssistantMessage("Definition: нет худа без добра; AdditionalTranslations:; Example: Even though he had lost the match, he had gained in experience and was now more confident. Every cloud has a silver lining."),
                new ChatRequestUserMessage(requestWord)
            }
        };
        var response = await _client.GetChatCompletionsAsync(options, ct);
        
        const string definitionFieldName = "Definition: ";
        const string additionalTranslationsFieldName = "AdditionalTranslations: ";
        const string exampleFieldName = "Example: ";
        
        var splitResponse = response.Value.Choices[0].Message.Content.Split(";");

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