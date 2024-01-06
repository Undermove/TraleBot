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

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class CheckQuizAnswerBotCommand(ITelegramBotClient client, IMediator mediator, BotConfiguration config)
    : IBotCommand
{
    public async Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var isQuizStarted = await mediator.Send(
            new CheckIsQuizStartedQuery { UserId = request.User!.Id },
            ct);
        return isQuizStarted;
    }

    public async Task Execute(TelegramRequest request, CancellationToken ct)
    {
        var checkResult = await mediator.Send(
            new CheckQuizAnswerCommand { UserId = request.User!.Id, Answer = request.Text },
            ct);

        await (checkResult switch {
            CheckQuizAnswerResult.CorrectAnswer correctAnswer => SendCorrectAnswerConfirmation(request, correctAnswer, ct),
            CheckQuizAnswerResult.IncorrectAnswer incorrectAnswer => SendIncorrectAnswerConfirmation(request, incorrectAnswer, ct),
            CheckQuizAnswerResult.QuizCompleted completed => CompleteQuiz(request, completed, ct),
            CheckQuizAnswerResult.SharedQuizCompleted sharedQuizCompleted => CompleteSharedQuiz(request, sharedQuizCompleted, ct),
            _ => throw new ArgumentOutOfRangeException()
        });
    }

    private async Task SendIncorrectAnswerConfirmation(TelegramRequest request, CheckQuizAnswerResult.IncorrectAnswer checkResult,
        CancellationToken ct)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "❌😞Прости, но ответ неверный." +
            $"\r\nПравильный ответ: {checkResult.CorrectWord}",
            cancellationToken: ct);
        
        if (checkResult.NextQuizQuestion != null)
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "Давай попробуем со следующим словом!",
                cancellationToken: ct);
            await client.SendQuizQuestion(request, checkResult.NextQuizQuestion, ct);
            return;
        }
        
        await Execute(request, ct);
    }

    private async Task SendCorrectAnswerConfirmation(
        TelegramRequest request,
        CheckQuizAnswerResult.CorrectAnswer checkResult,
        CancellationToken ct)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "✅Верно! Ты молодчина!",
            cancellationToken: ct);

        if (checkResult.AcquiredLevel != null)
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                $"{GetMedalType(checkResult.AcquiredLevel.Value)}",
                cancellationToken: ct);
        }
        else if (checkResult is { ScoreToNextLevel: not null, NextLevel: not null })
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                $"Переведи это слово правильно еще в {checkResult.ScoreToNextLevel} квизах и получи по нему {GetMedalType(checkResult.NextLevel.Value)}!",
                cancellationToken: ct);
        }

        if (checkResult.NextQuizQuestion != null)
        {
            await client.SendQuizQuestion(request, checkResult.NextQuizQuestion, ct);
            return;
        }

        await Execute(request, ct);
    }

    private async Task CompleteSharedQuiz(TelegramRequest request, CheckQuizAnswerResult.SharedQuizCompleted shareQuizCompleted,
        CancellationToken ct)
    {
        await mediator.Send(new CompleteQuizCommand { UserId = request.User!.Id }, ct);
        
        await SendResultCongrats(request, ct, shareQuizCompleted.CurrentUserScore);
        
        await client.SendTextMessageAsync(
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
            await client.SendTextMessageAsync(
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

    private async Task CompleteQuiz(TelegramRequest request, CheckQuizAnswerResult.QuizCompleted quizCompleted, CancellationToken ct)
    {
        var quizStats = await mediator.Send(new CompleteQuizCommand { UserId = request.User!.Id }, ct);
        
        await SendResultCongrats(request, ct, quizStats.CorrectnessPercent);
        
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "Вот твоя статистика:" +
            $"\r\n✅Правильные ответы:            {quizStats.CorrectAnswersCount}" +
            $"\r\n❌Неправильные ответы:        {quizStats.IncorrectAnswersCount}" +
            $"\r\n📏Корректных ответов:         {quizStats.CorrectnessPercent}%",
            replyMarkup: new InlineKeyboardMarkup(
                InlineKeyboardButton.WithCallbackData($"{CommandNames.MenuIcon} Меню", CommandNames.Menu)
                ),
            cancellationToken: ct);
        
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            "👉Хочешь поделиться квизом с другом? Просто нажми на кнопку: ",
            replyMarkup: new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithSwitchInlineQuery(
                        "Поделиться квизом",
                        $"Привет! Давай посоревнуемся в знании иностранных слов:" +
                        $"\r\nhttps://t.me/{config.BotName}?start={quizCompleted.ShareableQuizId}")
                }
            }),
            parseMode: ParseMode.Html,
            cancellationToken: ct);
    }

    private async Task SendResultCongrats(TelegramRequest request, CancellationToken ct, double correctnessPercent)
    {
        if (Math.Abs(correctnessPercent - 100) < 0.001)
        {
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "Максимальный результат! Ты молодец! 🎉🎉🎉",
                replyMarkup: new ReplyKeyboardRemove(),
                cancellationToken: ct);
            await client.SendTextMessageAsync(
                request.UserTelegramId,
                "🎆",
                cancellationToken: ct);
        }
        else
        {
            await client.SendTextMessageAsync(
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