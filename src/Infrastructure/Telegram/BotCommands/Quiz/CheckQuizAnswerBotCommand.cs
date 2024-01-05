using Application.Quizzes.Commands.CheckQuizAnswer;
using Application.Quizzes.Commands.CompleteQuiz;
using Application.Quizzes.Queries;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using QuizCompleted = Application.Quizzes.Commands.CheckQuizAnswer.QuizCompleted;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class CheckQuizAnswerBotCommand : IBotCommand
{
    private readonly BotConfiguration _config;
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public CheckQuizAnswerBotCommand(ITelegramBotClient client, IMediator mediator, BotConfiguration config)
    {
        _client = client;
        _mediator = mediator;
        _config = config;
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

        await checkResult.Match(
            correctAnswer => SendCorrectAnswerConfirmation(request, correctAnswer, ct),
            incorrectAnswer => SendIncorrectAnswerConfirmation(request, incorrectAnswer, ct),
            completed => CompleteQuiz(request, completed, ct),
            sharedQuizCompleted => CompleteSharedQuiz(request, sharedQuizCompleted, ct)
            );
    }

    private async Task SendIncorrectAnswerConfirmation(TelegramRequest request, IncorrectAnswer checkResult,
        CancellationToken ct)
    {
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "❌😞Прости, но ответ неверный." +
            $"\r\nПравильный ответ: {checkResult.CorrectAnswer}",
            cancellationToken: ct);
        
        if (checkResult.NextQuizQuestion != null)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "Давай попробуем со следующим словом!",
                cancellationToken: ct);
            await _client.SendQuizQuestion(request, checkResult.NextQuizQuestion, ct);
            return;
        }
        
        await Execute(request, ct);
    }

    private async Task SendCorrectAnswerConfirmation(
        TelegramRequest request,
        CorrectAnswer checkResult,
        CancellationToken ct)
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
        }
        else if (checkResult is { ScoreToNextLevel: not null, NextLevel: not null })
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                $"Переведи это слово правильно еще в {checkResult.ScoreToNextLevel} квизах и получи по нему {GetMedalType(checkResult.NextLevel.Value)}!",
                cancellationToken: ct);
        }

        if (checkResult.NextQuizQuestion != null)
        {
            await _client.SendQuizQuestion(request, checkResult.NextQuizQuestion, ct);
            return;
        }

        await Execute(request, ct);
    }

    private async Task CompleteSharedQuiz(TelegramRequest request, SharedQuizCompleted shareQuizCompleted,
        CancellationToken ct)
    {
        await _mediator.Send(new CompleteQuizCommand { UserId = request.User!.Id }, ct);
        
        await SendResultCongrats(request, ct, shareQuizCompleted.CurrentUserScore);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"""
             🖇Проверим результаты:"
             Твой результат:
             ✅Правильные ответы:         {shareQuizCompleted.CurrentUserScore}%

             Результат {shareQuizCompleted.QuizAuthorName}:
             📏Правильные ответы:         {shareQuizCompleted.QuizAuthorScore}%
             """,
            cancellationToken: ct);

        if (!request.User.InitialLanguageSet)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                @$"Привет, {request.UserName}!
Меня зовут Trale и я помогаю вести персональный словарь и закреплять выученное 🙂

Работаю с несколькими языками: 
Английский 🇬🇧
Грузинский 🇬🇪

Напиши мне незнакомое слово, а я найду его перевод и занесу в твой словарь по выбранному языку.

Один язык бесплатно, мультиязыковой словарь – по справедливой подписке.

Выбери язык, который хочешь учить, и начнем!
",
                replyMarkup: LanguageKeyboard.GetLanguageKeyboard($"{CommandNames.SetInitialLanguage}"),
                cancellationToken: ct);
        }
    }

    private async Task CompleteQuiz(TelegramRequest request, QuizCompleted quizCompleted, CancellationToken ct)
    {
        var quizStats = await _mediator.Send(new CompleteQuizCommand { UserId = request.User!.Id }, ct);
        
        await SendResultCongrats(request, ct, quizStats.CorrectnessPercent);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "Вот твоя статистика:" +
            $"\r\n✅Правильные ответы:            {quizStats.CorrectAnswersCount}" +
            $"\r\n❌Неправильные ответы:        {quizStats.IncorrectAnswersCount}" +
            $"\r\n📏Корректных ответов:         {quizStats.CorrectnessPercent}%",
            replyMarkup: new InlineKeyboardMarkup(
                InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню", CommandNames.Menu)
                ),
            cancellationToken: ct);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            "👉Хочешь поделиться квизом с другом? Просто нажми на кнопку: ",
            replyMarkup: new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithSwitchInlineQuery(
                        "Поделиться квизом",
                        $"Привет! Давай посоревнуемся в знании иностранных слов:" +
                        $"\r\nhttps://t.me/{_config.BotName}?start={quizCompleted.ShareableQuizId}")
                }
            }),
            parseMode: ParseMode.Html,
            cancellationToken: ct);
    }

    private async Task SendResultCongrats(TelegramRequest request, CancellationToken ct, double correctnessPercent)
    {
        if (Math.Abs(correctnessPercent - 100) < 0.001)
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "Максимальный результат! Ты молодец! 🎉🎉🎉",
                replyMarkup: new ReplyKeyboardRemove(),
                cancellationToken: ct);
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎆",
                cancellationToken: ct);
        }
        else
        {
            await _client.SendTextMessageAsync(
                request.UserTelegramId,
                "🏄‍Вот это квиз! Молодец, что стараешься! 💓",
                replyMarkup: new ReplyKeyboardRemove(),
                cancellationToken: ct);
        }
    }

    private string GetMedalType(MasteringLevel masteringLevel)
    {
        return masteringLevel switch
        {
            MasteringLevel.NotMastered => "🥈",
            MasteringLevel.MasteredInForwardDirection => "🥇",
            MasteringLevel.MasteredInBothDirections => "💎",
            _ => ""
        };
    }
}