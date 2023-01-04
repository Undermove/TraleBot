using Application.Common.Interfaces;
using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class TranslateCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly ITranslationService _translationService;

    public TranslateCommand(
        TelegramBotClient client, 
        ITranslationService translationService)
    {
        _client = client;
        _translationService = translationService;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken cancellationToken)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await _translationService.TranslateAsync(request.Text, token); 
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            result,
            cancellationToken: token);
    }
}