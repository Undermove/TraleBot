using Infrastructure.Telegram.Models;
using Infrastructure.Telegram.Services;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.GeorgianModule.VerbsOfMovement.Quiz;

public class GeorgianVerbsQuizAnswerCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IGeorgianQuizSessionService _quizSessionService;

    public GeorgianVerbsQuizAnswerCommand(
        ITelegramBotClient client,
        IGeorgianQuizSessionService quizSessionService)
    {
        _client = client;
        _quizSessionService = quizSessionService;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.Text.StartsWith(CommandNames.GeorgianVerbsQuizAnswer, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var session = await _quizSessionService.GetSessionAsync(request.UserTelegramId);
        if (session == null)
        {
            await _client.EditMessageTextAsync(
                request.UserTelegramId,
                request.MessageId,
                "❌ Сессия квиза не найдена. Пожалуйста, начните сначала.",
                cancellationToken: token);
            return;
        }

        // Handle special commands
        if (request.Text.EndsWith(":next", StringComparison.InvariantCultureIgnoreCase))
        {
            await SendNextQuestion(request.UserTelegramId, request.MessageId, session, token);
            return;
        }

        if (request.Text.EndsWith(":results", StringComparison.InvariantCultureIgnoreCase))
        {
            await ShowResults(request.UserTelegramId, request.MessageId, session, token);
            return;
        }

        // Parse the callback data: "/georgianverbsquizanswer:optionIndex"
        var parts = request.Text.Split(':');
        if (parts.Length < 2 || !int.TryParse(parts[1], out var selectedOptionIndex))
        {
            return;
        }

        var currentQuestion = session.Questions[session.CurrentQuestionIndex];
        var isAnswerCorrect = selectedOptionIndex == currentQuestion.AnswerIndex;

        var feedbackText = isAnswerCorrect
            ? $"✅ Правильно!\n\n{currentQuestion.Explanation}"
            : $"❌ Неправильно!\n\nПравильный ответ: {currentQuestion.Options[currentQuestion.AnswerIndex]}\n\n{currentQuestion.Explanation}";

        // Update stats
        if (isAnswerCorrect)
        {
            session.CorrectAnswersCount++;
        }
        else
        {
            session.IncorrectAnswersCount++;
            // Add to weak verbs if not already there
            if (!session.WeakVerbs.Contains(currentQuestion.Lemma))
            {
                session.WeakVerbs.Add(currentQuestion.Lemma);
            }
        }

        await _quizSessionService.UpdateSessionAsync(session);

        var buttons = new List<InlineKeyboardButton[]>();

        if (session.CurrentQuestionIndex + 1 < session.Questions.Count)
        {
            // More questions remain
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("▶️ Следующий вопрос", CommandNames.GeorgianVerbsQuizAnswer + ":next")
            });
        }
        else
        {
            // Quiz completed - show final stats
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("📊 Посмотреть результаты", CommandNames.GeorgianVerbsQuizAnswer + ":results")
            });
        }

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            feedbackText,
            replyMarkup: new InlineKeyboardMarkup(buttons.ToArray()),
            cancellationToken: token);
    }

    private async Task SendNextQuestion(long userTelegramId, int messageId, GeorgianQuizSessionState session, CancellationToken token)
    {
        session.CurrentQuestionIndex++;
        await _quizSessionService.UpdateSessionAsync(session);

        var currentQuestion = session.Questions[session.CurrentQuestionIndex];
        var questionNumber = session.CurrentQuestionIndex + 1;
        var totalQuestions = session.Questions.Count;

        var questionText = $"❓ Вопрос {questionNumber}/{totalQuestions}\n\n{currentQuestion.Question}\n\n";

        var buttons = new List<InlineKeyboardButton[]>();

        for (int i = 0; i < currentQuestion.Options.Count; i++)
        {
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData(
                    currentQuestion.Options[i],
                    $"{CommandNames.GeorgianVerbsQuizAnswer}:{i}")
            });
        }

        var keyboard = new InlineKeyboardMarkup(buttons.ToArray());

        await _client.EditMessageTextAsync(
            userTelegramId,
            messageId,
            questionText,
            replyMarkup: keyboard,
            cancellationToken: token);
    }

    private async Task ShowResults(long userTelegramId, int messageId, GeorgianQuizSessionState session, CancellationToken token)
    {
        var totalQuestions = session.Questions.Count;
        var accuracy = totalQuestions > 0
            ? Math.Round(100.0 * session.CorrectAnswersCount / totalQuestions, 0)
            : 0;

        var shortTitle = session.LessonId switch
        {
            1 => "Знакомство с глаголами движения",
            2 => "Приставки направления",
            3 => "Спряжение настоящего времени",
            4 => "Закрепление настоящего времени",
            5 => "Прошедшее время (основы)",
            6 => "Склонения прошедшего времени",
            7 => "Закрепление прошедшего",
            8 => "Будущее время (основы)",
            9 => "Склонения будущего времени",
            10 => "Итоговое закрепление",
            11 => "Прошедшее несовершённое время",
            _ => "Материал"
        };

        var weakVerbs = session.WeakVerbs;
        var weakText = weakVerbs.Count > 0 ? string.Join(", ", weakVerbs) : "—";

        var resultsText =
            $"✅ Отлично!\n" +
            $"Ты прошёл урок {session.LessonId} — {shortTitle}.\n\n" +
            $"📊 Точность: {accuracy}%\n" +
            $"💡 Слабые места: {weakText}\n\n" +
            $"⏭ Следующий шаг: вернись завтра, чтобы закрепить и получить новые контексты.";

        var buttons = new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("⬅️ К урокам", CommandNames.GeorgianVerbsOfMovement)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🏠 В главное меню", "/menu")
            }
        };

        await _quizSessionService.EndSessionAsync(userTelegramId);

        await _client.EditMessageTextAsync(
            userTelegramId,
            messageId,
            resultsText,
            replyMarkup: new InlineKeyboardMarkup(buttons),
            cancellationToken: token);
    }
}