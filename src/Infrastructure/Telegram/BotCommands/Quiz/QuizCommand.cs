using Application.Quizzes.Commands.StartNewQuiz;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class QuizCommand(ITelegramBotClient client, IMediator mediator) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.Quiz, StringComparison.InvariantCultureIgnoreCase) ||
                               commandPayload.StartsWith(CommandNames.QuizIcon,
                                   StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var result =
            await mediator.Send(new StartNewQuizCommand
                {
                    UserId = request.User!.Id,
                    UserName = request.UserName,
                },
                token);
        
        await (result switch 
        {
            StartNewQuizResult.QuizStarted started => SendFirstQuestion(request, started, token),
            StartNewQuizResult.NotEnoughWords _ => HandleNotEnoughWords(request, token),
            StartNewQuizResult.QuizAlreadyStarted _ => HandleQuizAlreadyStarted(request, token),
            _ => throw new ArgumentOutOfRangeException()
        });
    }

    private async Task SendFirstQuestion(TelegramRequest request, StartNewQuizResult.QuizStarted quizStarted, CancellationToken token)
    {
        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"Начнем квиз! В него войдет {quizStarted.QuizQuestionsCount} вопросов." +
            $"\r\n🏁На случай, если захочешь закончить квиз – вот команда {CommandNames.StopQuiz}",
            cancellationToken: token);

        await client.SendQuizQuestion(request, quizStarted.FirstQuestion, token);
    }

    private async Task HandleNotEnoughWords(TelegramRequest request, CancellationToken token)
    {
        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Для этого типа квизов пока не хватает слов. Попробуй набрать больше слов или закрепить новые 😉",
            cancellationToken: token);
    }

    private async Task HandleQuizAlreadyStarted(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData($"{CommandNames.StopQuizIcon} Остановить квиз",
                    $"{CommandNames.StopQuiz}")
            },
        });

        await client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "Кажется, что ты уже начал один квиз." +
            "\r\nЕсли хочешь его закончить, просто нажми на кнопку",
            replyMarkup: keyboard,
            cancellationToken: token);
    }
}