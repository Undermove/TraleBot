using Application.Quizzes.Commands.StartNewQuiz;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class StartQuizBotCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public StartQuizBotCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.Quiz) && 
                               commandPayload.Split(' ').Length > 1);
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var quizTypeString = request.Text.Split(' ')[1];
        Enum.TryParse<QuizTypes>(quizTypeString, true, out var quizType);

        var result = await _mediator.Send(new StartNewQuizCommand
        {
            UserId = request.User!.Id,
            UserName = request.UserName,
            QuizType = quizType
        }, token);

        await result.Match(
            started => SendFirstQuestion(request, started, token),
            _ => HandleNotEnoughWords(request, token),
            _ => HandleNeedPremiumToActivate(request, token),
            _ => HandleQuizAlreadyStarted(request, token)
        );
    }
    
    private async Task SendFirstQuestion(TelegramRequest request, QuizStarted quizStarted, CancellationToken token)
    {
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"Начнем квиз! В него войдет {quizStarted.QuizQuestionsCount} вопросов." +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        await _client.SendQuizQuestion(request, quizStarted.FirstQuestion, token);
    }
    
    private async Task HandleNotEnoughWords(TelegramRequest request, CancellationToken token)
    {
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Для этого типа квизов пока не хватает слов. Попробуй набрать больше слов или закрепить новые 😉",
            cancellationToken: token);
    }

    private async Task HandleNeedPremiumToActivate(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("✅ Пробная на месяц. (карта не нужна)", $"{CommandNames.ActivateTrial}") },
            new[] { InlineKeyboardButton.WithCallbackData("💳 Купить подписку.", $"{CommandNames.Pay}") }
        });
            
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Для прохождения этого типа квиза нужен премиум аккаунт.",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
    
    private async Task HandleQuizAlreadyStarted(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData($"{CommandNames.StopQuizIcon} Остановить квиз", $"{CommandNames.StopQuiz}") },
        });
        
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Кажется, что ты уже начал один квиз." +
            "\r\nЕсли хочешь его закончить, просто нажми на кнопку",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}