using Application.Users.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class ChangeCurrentLanguageCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public ChangeCurrentLanguageCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeCurrentLanguage, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var targetLanguage = request.Text.Split(' ')[1];
        var currentLanguage = await _mediator.Send(new ChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = Enum.Parse<Language>(targetLanguage)
        }, token);
        
        // need to send message with keyboard to change language
        await _client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: MenuKeyboard.GetMenuKeyboard(currentLanguage),
            cancellationToken: token);
    }
}