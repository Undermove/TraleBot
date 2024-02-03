using Application.Users.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CallbackSerialization;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class ChangeCurrentLanguageCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ChangeCurrentLanguage, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var targetLanguage = request.Text.Split(' ')[1];
        var result = await mediator.Send(new ChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            TargetLanguage = Enum.Parse<Language>(targetLanguage)
        }, token);

        await (result switch
        {
            ChangeLanguageResult.Success success => HandleSuccess(request, success.CurrentLanguage, token),
            ChangeLanguageResult.PremiumRequired premiumRequired => HandlePremiumRequired(request, premiumRequired, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private Task HandleSuccess(TelegramRequest request, Language currentLanguage, CancellationToken token)
    {
        // need to send message with keyboard to change language
        return client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: MenuKeyboard.GetMenuKeyboard(currentLanguage),
            cancellationToken: token);
    }

    private async Task HandlePremiumRequired(
        TelegramRequest request,
        ChangeLanguageResult.PremiumRequired premiumRequired,
        CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId, 
            text: $@"Бесплатный аккаунт позволяет вести словарь только на одном языке. 

При переключении на другой язык, текущий словарь {premiumRequired.CurrentLanguage.GetLanguageFlag()} будет удалён. Чтобы иметь несколько словарей на разных языках, подключи ⭐️ Премиум-аккаунт в меню.",
            replyMarkup: new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData(
                        $"Удалить и переключиться на {premiumRequired.TargetLanguage.GetLanguageFlag()}",
                        new ChangeLanguageAndDeleteVocabularyCallback
                        {
                            TargetLanguage = premiumRequired.TargetLanguage,
                        }.Serialize())
                        
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("Подробнее о Премиуме", CommandNames.Pay)
                }
            }),
            cancellationToken: token);
    }
}