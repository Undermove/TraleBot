using Application.Users.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class ChangeCurrentLanguageAndDeleteVocabularyCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeCurrentLanguageAndDeleteVocabulary, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var command = request.Text.Deserialize<ChangeLanguageAndDeleteVocabularyCallback>();
        var result = await mediator.Send(new ChangeCurrentLanguageAndDeleteVocabulary
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = command.TargetLanguage
        }, token);

        await (result switch
        {
            ChangeCurrentLanguageAndDeleteVocabularyResult.Success success => HandleSuccess(request, success.CurrentLanguage, token),
            ChangeCurrentLanguageAndDeleteVocabularyResult.NoActionNeeded => HandleNoActionNeeded(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private async Task HandleSuccess(TelegramRequest request, Language currentLanguage, CancellationToken token)
    {
        // need to send message with keyboard to change language
        await client.EditMessageTextAsync(request.UserTelegramId, 
            request.MessageId, 
            "👌 Язык успешно изменён.",
            cancellationToken: token);
        await client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: MenuKeyboard.GetMenuKeyboard(currentLanguage),
            cancellationToken: token);
    }

    private async Task HandleNoActionNeeded(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            @"🙇‍ У тебя есть премиум, так что ты можешь просто перевести слово без удаления словаря.",
            cancellationToken: token);
    }
}

public class ChangeLanguageAndDeleteVocabularyCallback
{
    public string CommandName => CommandNames.ChangeCurrentLanguageAndDeleteVocabulary;
    public Language TargetLanguage { get; init; }
}