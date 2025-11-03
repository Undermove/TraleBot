using Application.GeorgianVerbs;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.VerbLearning;

public class StartVerbLearningCommand(IMediator mediator, ITelegramBotClient client)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var text = request.Text;
        return Task.FromResult(
            text.Equals(CommandNames.StartVerbLearning, StringComparison.InvariantCultureIgnoreCase) ||
            text.StartsWith(CommandNames.StartVerbLearningIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
            return;

        var nextCardQuery = new GetNextVerbCardQuery { UserId = request.User.Id };
        var cardResult = await mediator.Send(nextCardQuery, token);

        if (cardResult is GetNextVerbCardResult.NoCardsAvailable)
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎉 Ты прошёл все упражнения! Приходи позже для повторения.",
                cancellationToken: token);
            return;
        }

        if (cardResult is not GetNextVerbCardResult.CardReady ready)
            return;

        await DisplayCard(request.UserTelegramId, ready.Card, token);
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
            $"🎓 {card.QuestionGeorgian}\n\n{card.Question}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}