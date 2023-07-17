using Application.Quizzes.Commands;
using Application.Quizzes.Commands.StartNewQuiz;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
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

        var result = await _mediator.Send(new StartNewQuizCommand {UserId = request.User!.Id, QuizType = quizType}, token);

        if (await IsQuizNotStarted(request, token, result))
        {
            return;
        }
        
        await SendFirstQuestion(request, token, result);
    }

    private async Task SendFirstQuestion(TelegramRequest request, CancellationToken token, StartNewQuizResult result)
    {
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"Начнем квиз! В него войдет {result.LastWeekVocabularyEntriesCount} выученных слов. " +
            "\r\nТы вызываешь у меня восторг!" +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        var quizQuestion = await _mediator.Send(new GetNextQuizQuestionQuery { UserId = request.User!.Id }, token);

        if (quizQuestion != null)
        {
            await _client.SendQuizQuestion(request, quizQuestion, token);
        }
    }

    private async Task<bool> IsQuizNotStarted(TelegramRequest request, CancellationToken token, StartNewQuizResult result)
    {
        switch (result.QuizStartStatus)
        {
            case QuizStartStatus.NotEnoughWords:
                await _client.EditMessageTextAsync(
                    request.UserTelegramId,
                    request.MessageId,
                    "Для этого типа квизов пока не хватает слов. Попробуй набрать больше слов или закрепить новые 😉",
                    cancellationToken: token);
                return true;
            case QuizStartStatus.AlreadyStarted:
                await _client.EditMessageTextAsync(
                    request.UserTelegramId,
                    request.MessageId,
                    "Кажется, что ты уже начал один квиз." +
                    $"\r\nЕсли хочешь его закончить, просто пришли {CommandNames.StopQuiz}",
                    cancellationToken: token);
                return true;
            case QuizStartStatus.NeedPremiumToActivate:
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
                return true;
            }
            case QuizStartStatus.Success:
            default:
                return false;
        }
    }
}