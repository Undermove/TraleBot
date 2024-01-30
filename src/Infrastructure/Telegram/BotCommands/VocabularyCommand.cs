using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class VocabularyCommand(IMediator mediator, ITelegramBotClient client) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Vocabulary, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.VocabularyIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result =  await mediator.Send(new GetVocabularyEntriesList {UserId = request.User!.Id}, token);

        if (!result.VocabularyEntriesPages.Any())
        {
            await client.SendTextMessageAsync(request.UserTelegramId, "📖Словарь пока пуст", cancellationToken: token);
            return;
        }

        await client.SendTextMessageAsync(
            request.UserTelegramId, 
            @$"📖Слов в твоём словаре {request.User.Settings.CurrentLanguage.GetLanguageFlag()}: {result.VocabularyWordsCount}

            🥈 - новые слова

            🥇 - закрепленное слово. Ты правильно перевел его в более чем 3 квизах

            💎 - теперь точно запомнил! Закрепленное в двух направлениях слово по результатам 3 квизов

            Проходи квизы и переводи слова, чтобы получить 🥇 и 💎 по всем словам!", 
            cancellationToken: token);
        foreach (var batch in result.VocabularyEntriesPages)
        {
            var vocabularyEntryView = batch
                .Select(entry => 
                    $"{GetMedalType(entry)} {entry.Word} – {entry.Definition}");
            var vocabularyPageView = String.Join(Environment.NewLine, vocabularyEntryView);
            
            await client.SendTextMessageAsync(request.UserTelegramId, vocabularyPageView, parseMode: ParseMode.Html, cancellationToken: token);    
        }
        
        await client.SendTextMessageAsync(
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