using Infrastructure.Telegram.Models;
using Infrastructure.Telegram.Services;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.GeorgianModule.VerbsOfMovement.Quiz;

public class GeorgianVerbsQuizStartCommand(
    int lessonId,
    ITelegramBotClient client,
    IGeorgianQuizSessionService quizSessionService,
    IGeorgianQuestionsLoaderFactory loaderFactory) : IBotCommand
{
    private readonly IGeorgianQuestionsLoader _questionsLoader = loaderFactory.CreateForLesson(lessonId);

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
        => Task.FromResult(
            request.Text.Equals($"/georgianverbsquizstart{lessonId}", StringComparison.InvariantCultureIgnoreCase));

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var questions = _questionsLoader.LoadQuestionsForLesson(lessonId);
        if (questions.Count == 0)
        {
            await client.EditMessageTextAsync(
                request.UserTelegramId,
                request.MessageId,
                "❌ Извините, не удалось загрузить вопросы для этого урока.",
                cancellationToken: token);
            return;
        }

        await quizSessionService.StartQuizSessionAsync(request.UserTelegramId, lessonId, questions);
        await SendQuestion(request.UserTelegramId, request.MessageId, token);
    }

    private async Task SendQuestion(long userTelegramId, int messageId, CancellationToken token)
    {
        var session = await quizSessionService.GetSessionAsync(userTelegramId);
        if (session == null) return;

        var currentQuestion = session.Questions[session.CurrentQuestionIndex];
        var questionText = $"❓ Вопрос {session.CurrentQuestionIndex + 1}/{session.Questions.Count}\n\n{currentQuestion.Question}\n\n";

        var buttons = currentQuestion.Options
            .Select((opt, i) => new[] { InlineKeyboardButton.WithCallbackData(opt, $"{CommandNames.GeorgianVerbsQuizAnswer}:{i}") })
            .ToList();

        await client.EditMessageTextAsync(
            userTelegramId,
            messageId,
            questionText,
            replyMarkup: new InlineKeyboardMarkup(buttons),
            cancellationToken: token);
    }
}
