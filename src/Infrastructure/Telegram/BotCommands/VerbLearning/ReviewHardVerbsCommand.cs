using Application.GeorgianVerbs;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.VerbLearning;

public class ReviewHardVerbsCommand(IMediator mediator, ITelegramBotClient client)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var text = request.Text;
        return Task.FromResult(
            text.Equals(CommandNames.ReviewHardVerbs, StringComparison.InvariantCultureIgnoreCase) ||
            text.StartsWith(CommandNames.ReviewHardVerbsIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
            return;

        var query = new GetHardVerbCardsQuery { UserId = request.User.Id };
        var result = await mediator.Send(query, token);

        if (result is not GetHardVerbCardsResult.CardsFound found || !found.Cards.Any())
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎉 Нет трудных слов! Отличная работа!",
                cancellationToken: token);
            return;
        }

        // Показываем первую карточку
        var card = found.Cards.First();
        await DisplayCard(request.UserTelegramId, card, token);
    }

    private async Task DisplayCard(long chatId, VerbCard card, CancellationToken token)
    {
        var buttons = new List<InlineKeyboardButton[]>();

        var allOptions = new List<string> { card.CorrectAnswer };
        allOptions.AddRange(card.IncorrectOptions ?? []);
        
        // Используем детерминированный Random на основе ID карточки для консистентного перемешивания
        var random = new Random(card.Id.GetHashCode());
        var shuffled = allOptions.OrderBy(_ => random.Next()).ToList();

        for (int i = 0; i < shuffled.Count; i += 2)
        {
            var row = new List<InlineKeyboardButton>();

            var option1 = shuffled[i];
            var callback1 = $"{CommandNames.SubmitVerbAnswer} {card.Id} {i}";
            row.Add(InlineKeyboardButton.WithCallbackData(option1, callback1));

            if (i + 1 < shuffled.Count)
            {
                var option2 = shuffled[i + 1];
                var callback2 = $"{CommandNames.SubmitVerbAnswer} {card.Id} {i + 1}";
                row.Add(InlineKeyboardButton.WithCallbackData(option2, callback2));
            }

            buttons.Add(row.ToArray());
        }

        var keyboard = new InlineKeyboardMarkup(buttons);

        await client.SendTextMessageAsync(
            chatId,
            $"🧠 Трудное слово\n\n🎓 {card.QuestionGeorgian}\n\n{card.Question}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}