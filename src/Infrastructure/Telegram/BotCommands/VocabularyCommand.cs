using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class VocabularyCommand : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly TelegramBotClient _client;

    public VocabularyCommand(IMediator mediator, TelegramBotClient client)
    {
        _mediator = mediator;
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Vocabulary, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.VocabularyIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result =  await _mediator.Send(new GetVocabularyEntriesListQuery {UserId = request.User!.Id}, token);

        if (!result.VocabularyEntries.Any())
        {
            // todo: refactor this to receive specified answer from app layer
            if (result.VocabularyWordsCount > 0)
            {
                await OfferTrial(request, token, result);
                return;
            }
            
            await _client.SendTextMessageAsync(request.UserTelegramId, "📖Словарь пока пуст", cancellationToken: token);
            return;
        }

        await _client.SendTextMessageAsync(
            request.UserTelegramId, 
            $"📖В вашем словаре уже {result.VocabularyWordsCount} слов!" +
            $"\r\n🥈 - новые слова" +
            $"\r\n(мало правильных ответов в квизах)" +
            $"\r\n🥇 - закрепелнные хорошо" +
            $"\r\n(правильных ответов в квизах больше неправильных)" +
            $"\r\nЦифрами указана статистика по квизам (правильно/неправильно)",
            //$"\r\n💎 - отлично закрепленные (правильных ответов больше во всех направлениях)", 
            cancellationToken: token);
        foreach (var batch in result.VocabularyEntries)
        {
            var vocabularyEntryView = batch.Select(entry => $"{GetMedalType(entry)} {entry.Word} - {entry.Definition} {entry.SuccessAnswersCount}/{entry.FailedAnswersCount}");
            var vocabularyPageView = String.Join(Environment.NewLine, vocabularyEntryView);
            
            await _client.SendTextMessageAsync(request.UserTelegramId, vocabularyPageView, cancellationToken: token);    
        }
        
        if (!request.User.IsActivePremium())
        {
            await _client.SendTextMessageAsync(request.UserTelegramId, "Для бесплатной версии доступны только последние 7 дней", cancellationToken: token);
        }
    }

    private async Task OfferTrial(TelegramRequest request, CancellationToken token, VocabularyEntriesListVm result)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("✅ Пробная на месяц. (карта не нужна)",
                    $"{CommandNames.ActivateTrial}")
            },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Год со скидкой. За 159 рублей", $"{CommandNames.Pay}") }
        });
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"🔐Для разблокирования истории из {result.VocabularyWordsCount} слов активируйте триал или премиум подписку",
            replyMarkup: keyboard,
            cancellationToken: token);
    }

    private string GetMedalType(VocabularyEntry entry)
    {
        switch (entry.GetMasteringLevel())
        {
            case MasteringLevel.NotMastered:
                return "🥈";
            case MasteringLevel.MasteredInForwardDirection:
                return "🥇";
            case MasteringLevel.MasteredInBothDirections:
                return "💎";
        }
        
        return "";
    } 
}