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
        var a = _openAIApi.Chat.StreamChatEnumerableAsync(new ChatRequest
        {
            Model = Model.ChatGPTTurbo,
            Messages = new List<ChatMessage>
            {
                new()
                {
                    Content = "",
                    Role = ChatMessageRole.User
                }
            }
        });

        return new TranslationResult("definition", "text", "example", true);
    }
}

public class OpenAiConfig
{
    public string ApiKey { get; set; }
}