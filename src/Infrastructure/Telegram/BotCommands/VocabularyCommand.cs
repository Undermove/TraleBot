using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class VocabularyCommand : IBotCommand
{
    private readonly IMediator _mediator;
    private readonly ITelegramBotClient _client;

    public VocabularyCommand(IMediator mediator, ITelegramBotClient client)
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
        var result =  await _mediator.Send(new GetVocabularyEntriesList {UserId = request.User!.Id}, token);

        if (!result.VocabularyEntriesPages.Any())
        {
            await _client.SendTextMessageAsync(request.UserTelegramId, "📖Словарь пока пуст", cancellationToken: token);
            return;
        }

        await _client.SendTextMessageAsync(
            request.UserTelegramId, 
            $"📖Слов в твоём словаре {request.User.Settings.CurrentLanguage.GetLanguageFlag()}: {result.VocabularyWordsCount}" +
            "\r\n🥈 - новые слова" +
            "\r\n🥇 - закрепленное слово. Ты правильно перевел его в более чем 3 квизах" +
            "\r\n💎 - закрепленное в двух направлениях слово. Ты правильно перевел его в более чем 3 квизах по закрепленным словам" +
            "\r\nПроходи квизы и переводи слова, чтобы получить 🥇 и 💎 по всем словам!", 
            cancellationToken: token);
        foreach (var batch in result.VocabularyEntriesPages)
        {
            var vocabularyEntryView = batch
                .Select(entry => 
                    $"{GetMedalType(entry)} {entry.Word} – {entry.Definition}");
            var vocabularyPageView = String.Join(Environment.NewLine, vocabularyEntryView);
            
            await _client.SendTextMessageAsync(request.UserTelegramId, vocabularyPageView, ParseMode.Html, cancellationToken: token);    
        }
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"{CommandNames.MenuIcon} Меню",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(request.User.Settings.CurrentLanguage),
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