using Application.Users.Commands;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class SetInitialLanguage(IMediator mediator, ITelegramBotClient client) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.SetInitialLanguage));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await mediator.Send(new Application.Users.Commands.SetInitialLanguage
        {
            UserId = request.User.Id,
            InitialLanguage = ToLanguage(request.Text.Split(' ')[1])
        }, token);

        await (result switch
        {
            SetInitialLanguageResult.InitialLanguageSet languageSet => HandleInitialLanguageSet(request, languageSet, token),
            SetInitialLanguageResult.InitialLanguageAlreadySet => HandleInitialLanguageAlreadySet(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    private async Task HandleInitialLanguageSet(TelegramRequest request,
        SetInitialLanguageResult.InitialLanguageSet initialLanguageSet, CancellationToken ct)
    {
        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
@$"
Отлично я буду переводить слова с {initialLanguageSet.InitialLanguage.GetLanguageFlag()} на русский и обратно

Ты можешь переключить язык в любой момент в меню.
", 
            replyMarkup: MenuKeyboard.GetMenuKeyboard(initialLanguageSet.InitialLanguage), 
            cancellationToken: ct);
    }

    private async Task HandleInitialLanguageAlreadySet(
        TelegramRequest request,
        CancellationToken ct)
    {
        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Ты уже выбрал основной язык, если хочешь пользоваться мультисловарем, то нужно активировать премиум",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(request.User.Settings.CurrentLanguage),
            cancellationToken: ct);
    }
    
    private static Language ToLanguage(string stringLanguage)
    {
        return Enum.Parse<Language>(stringLanguage);
    }
}