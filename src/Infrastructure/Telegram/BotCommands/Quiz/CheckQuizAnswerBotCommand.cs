using Application.Quizzes.Commands;
using Application.Quizzes.Commands.CheckQuizAnswer;
using Application.Quizzes.Commands.CompleteQuiz;
using Application.Quizzes.Queries;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class CheckQuizAnswerBotCommand: IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public CheckQuizAnswerBotCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public async Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var isQuizStarted = await _mediator.Send(
            new CheckIsQuizStartedQuery { UserId = request.User!.Id },
            ct);
        return isQuizStarted;
    }

    public async Task Execute(TelegramRequest request, CancellationToken ct)
    {
        var checkResult = await _mediator.Send(
            new CheckQuizAnswerCommand { UserId = request.User!.Id, Answer = request.Text },
            ct);

        if (checkResult.IsAnswerCorrect)
        {
            await SendCorrectAnswerConfirmation(request, ct, checkResult);
        }
        else
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "❌😞Прости, но ответ неверный." +
                $"\r\nПравильный ответ: {checkResult.CorrectAnswer}" +
                "\r\nДавай попробуем со следующим словом!",
                cancellationToken: ct);
        }
        
        await TrySendNextQuestion(request, ct);
    }

    private async Task SendCorrectAnswerConfirmation(TelegramRequest request, CancellationToken ct,
        CheckQuizAnswerResult checkResult)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "✅Верно! Ты молодчина!",
            cancellationToken: ct);

        if (checkResult.AcquiredLevel != null)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"{GetMedalType(checkResult.AcquiredLevel.Value)}",
                cancellationToken: ct);
            
            return;
        }
        
        if (checkResult.ScoreToNextLevel != null && checkResult.NextLevel != null)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"Переведи это слово правильно еще в {checkResult.ScoreToNextLevel} квизах и получи по нему {GetMedalType(checkResult.NextLevel.Value)}!",
                cancellationToken: ct);
        }
    }

    private async Task TrySendNextQuestion(TelegramRequest request, CancellationToken ct)
    {
        var word = await _mediator.Send(new GetNextQuizQuestionQuery { UserId = request.User!.Id }, ct);
        if (word == null)
        {
            await CompleteQuiz(request, ct);
            return;
        }

        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Переведи слово: *{word.Question}*",
            ParseMode.Markdown,
            replyMarkup: new InlineKeyboardMarkup(InlineKeyboardButton.WithCallbackData("⏭ Пропустить")),
            cancellationToken: ct);
    }

    private async Task CompleteQuiz(TelegramRequest request, CancellationToken ct)
    {
        var quizStats = await _mediator.Send(new CompleteQuizCommand { UserId = request.User!.Id }, ct);
        double correctnessPercent = Math.Round(100 * (quizStats.CorrectAnswersCount / (quizStats.IncorrectAnswersCount + (double)quizStats.CorrectAnswersCount)), 0);
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "🏄‍Вот это квиз! Молодец, что стараешься! 💓" +
            "\r\nВот твоя статистика:" +
            $"\r\n✅Правильные ответы:            {quizStats.CorrectAnswersCount}" +
            $"\r\n❌Неправильные ответы:        {quizStats.IncorrectAnswersCount}" +
            $"\r\n📏Корректных ответов:         {correctnessPercent}%",
            cancellationToken: ct);
    }
    
    private string GetMedalType(MasteringLevel masteringLevel)
    {
        switch (masteringLevel)
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