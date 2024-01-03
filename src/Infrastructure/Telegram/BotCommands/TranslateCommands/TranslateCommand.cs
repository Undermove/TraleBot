using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result = await mediator.Send(new TranslateAndCreateVocabularyEntry
        {
            Word = request.Text,
            UserId = request.User?.Id ?? throw new ApplicationException("User not registered"),
        }, token);

        await (result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess success => client.HandleSuccess(request, success, token),
            CreateVocabularyEntryResult.TranslationExists exists => client.HandleTranslationExists(request, exists,  token),
            CreateVocabularyEntryResult.EmojiDetected => HandleEmojiDetected(request, token),
            CreateVocabularyEntryResult.PromptLengthExceeded => HandlePromptLengthExceeded(request, token),
            CreateVocabularyEntryResult.TranslationFailure => HandleFailure(request, token),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }
    
    private async Task HandleEmojiDetected(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "Кажется, что ты отправил мне слишком много эмодзи 😅.",
            cancellationToken: token);
    }
    
    private async Task HandlePromptLengthExceeded(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            @"
📏 Длинна строки слишком большая. Попробуй сократить её. Разрешено не более 40 символов.
",
            cancellationToken: token);
    }
    
    private async Task HandleFailure(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            $"🙇‍ Пока не могу перевести это слово. Для текущего языка перевода: {request.User!.Settings.CurrentLanguage.GetLanguageFlag()}" +
            "\r\nСлова нет в моей базе или в нём есть опечатка." +
            "\r\n" +
            "\r\nЕсли хочешь добавить ручной перевод, то введи его в формате: слово-перевод" +
            "\r\nК примеру: cat-кошка",
            cancellationToken: token);
    }
}