using Application.Quizzes.Commands;
using Application.Quizzes.Commands.CheckQuizAnswer;
using Application.Quizzes.Commands.CompleteQuiz;
using Application.Quizzes.Queries;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class CheckQuizAnswerBotCommand: IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public CheckQuizAnswerBotCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public async Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var isQuizStarted = await _mediator.Send(
            new CheckIsQuizStartedQuery { UserId = request.UserId },
            ct);
        return isQuizStarted;
    }

    public async Task Execute(TelegramRequest request, CancellationToken ct)
    {
        var checkResult = await _mediator.Send(
            new CheckQuizAnswerCommand { UserId = request.UserId, Answer = request.Text },
            ct);

        if (checkResult.IsAnswerCorrect)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎆Верно! Ты молодчина!",
                cancellationToken: ct);
        }
        else
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "😞Прости, но ответ неверный. " +
                $"\r\nПравильный ответ: {checkResult.CorrectAnswer}" +
                "\r\nДавай попробуем со следующим словом!",
                cancellationToken: ct);
        }
        
        await TrySendNextQuestion(request, ct);
    }

    private async Task TrySendNextQuestion(TelegramRequest request, CancellationToken ct)
    {
        var word = await _mediator.Send(new GetNextQuizQuestionQuery { UserId = request.UserId }, ct);
        if (word == null)
        {
            await CompleteQuiz(request, ct);
            return;
        }

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Переведи слово: {word.Word}",
            cancellationToken: ct);
    }

    private async Task CompleteQuiz(TelegramRequest request, CancellationToken ct)
    {
        var quizStats = await _mediator.Send(new CompleteQuizCommand { UserId = request.UserId }, ct);
        double correctnessPercent = Math.Round(100 * (quizStats.CorrectAnswersCount / (quizStats.IncorrectAnswersCount + (double)quizStats.CorrectAnswersCount)), 0);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "🏄‍Вот это квиз! Вне зависимости от результатов ты молодец, что стараешься." +
            $"\r\nВот твоя статистика:" +
            $"\r\n✅Правильные ответы:            {quizStats.CorrectAnswersCount}" +
            $"\r\n❌Неправильные ответы:        {quizStats.IncorrectAnswersCount}" +
            $"\r\n📏Процент корректных ответов: {correctnessPercent}",
            cancellationToken: ct);
    }
}