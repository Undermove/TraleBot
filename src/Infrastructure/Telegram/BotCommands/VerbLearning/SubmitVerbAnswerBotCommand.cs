using Application.GeorgianVerbs;
using Application.GeorgianVerbs.Commands;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.VerbLearning;

public class SubmitVerbAnswerBotCommand(IMediator mediator, ITelegramBotClient client)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(request.Text.StartsWith(CommandNames.SubmitVerbAnswer));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
            return;

        // Парсим callback: "/submitverbanswerr {cardId} {optionIndex}"
        var parts = request.Text.Split(' ');
        if (parts.Length < 3)
            return;

        if (!Guid.TryParse(parts[1], out var cardId))
            return;

        if (!int.TryParse(parts[2], out var optionIndex))
            return;

        // Получаем карточку для определения правильного ответа
        var cardQuery = new GetNextVerbCardQuery { UserId = request.User.Id };
        var cardResult = await mediator.Send(cardQuery, token);
        
        if (cardResult is not GetNextVerbCardResult.CardReady ready)
        {
            await HandleCardNotFound(request, token);
            return;
        }

        var card = ready.Card;
        if (card.Id != cardId)
        {
            await HandleCardNotFound(request, token);
            return;
        }

        // Восстанавливаем список всех опций с тем же детерминированным перемешиванием
        var allOptions = new List<string> { card.CorrectAnswer };
        allOptions.AddRange(card.IncorrectOptions ?? []);
        
        var random = new Random(card.Id.GetHashCode());
        var shuffled = allOptions.OrderBy(_ => random.Next()).ToList();

        if (optionIndex < 0 || optionIndex >= shuffled.Count)
            return;

        var answer = shuffled[optionIndex];

        // Определяем рейтинг (пока используем 3 = нормально)
        const int rating = 3;

        var submitCommand = new SubmitVerbAnswerCommand
        {
            UserId = request.User.Id,
            VerbCardId = cardId,
            StudentAnswer = answer,
            Rating = rating
        };

        var result = await mediator.Send(submitCommand, token);

        await (result switch
        {
            SubmitVerbAnswerResult.Success success => HandleSuccess(request, success, token),
            SubmitVerbAnswerResult.CardNotFound => HandleCardNotFound(request, token),
            SubmitVerbAnswerResult.UserNotFound => HandleUserNotFound(request, token),
            _ => Task.CompletedTask
        });
    }

    private async Task HandleSuccess(TelegramRequest request, SubmitVerbAnswerResult.Success result, CancellationToken token)
    {
        var status = result.IsCorrect ? "✅ Верно!" : "❌ Неверно!";
        
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            $"{status}\n\n📚 {result.Explanation}",
            cancellationToken: token);

        // Показываем следующую карточку
        if (result.NextCard != null)
        {
            await DisplayCard(request.UserTelegramId, result.NextCard, token);
        }
        else
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎉 Ты прошёл все упражнения!",
                cancellationToken: token);
        }
    }

    private async Task HandleCardNotFound(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "⚠️ Карточка не найдена",
            cancellationToken: token);
    }

    private async Task HandleUserNotFound(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "⚠️ Пользователь не найден",
            cancellationToken: token);
    }

    private async Task DisplayCard(long chatId, VerbCard card, CancellationToken token)
    {
        var buttons = new List<InlineKeyboardButton[]>();

        // Добавляем кнопки ответов (максимум 2x2)
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