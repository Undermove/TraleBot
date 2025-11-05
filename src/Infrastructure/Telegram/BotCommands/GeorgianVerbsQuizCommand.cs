using Infrastructure.Telegram.Models;
using Infrastructure.Telegram.Services;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class GeorgianVerbsQuizCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IGeorgianQuizSessionService _quizSessionService;
    private readonly IGeorgianQuestionsLoader _questionsLoader;

    public GeorgianVerbsQuizCommand(
        ITelegramBotClient client,
        IGeorgianQuizSessionService quizSessionService,
        IGeorgianQuestionsLoader questionsLoader)
    {
        _client = client;
        _quizSessionService = quizSessionService;
        _questionsLoader = questionsLoader;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        return Task.FromResult(
            request.Text.StartsWith(CommandNames.GeorgianVerbsQuizStart1, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var lessonId = 1;
        
        // Load questions for the lesson
        var questions = _questionsLoader.LoadQuestionsForLesson(lessonId);

        if (questions.Count == 0)
        {
            await _client.EditMessageTextAsync(
                request.UserTelegramId,
                request.MessageId,
                "❌ Извините, не удалось загрузить вопросы для этого урока.",
                cancellationToken: token);
            return;
        }

        // Start quiz session
        await _quizSessionService.StartQuizSessionAsync(request.UserTelegramId, lessonId, questions);

        // Show first question
        await SendQuestion(request.UserTelegramId, request.MessageId, token);
    }

    private async Task SendQuestion(long userTelegramId, int messageId, CancellationToken token)
    {
        var session = await _quizSessionService.GetSessionAsync(userTelegramId);
        if (session == null)
            return;

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
                    $"{CommandNames.GeorgianVerbsQuizAnswer}:{session.CurrentQuestionIndex}:{i}")
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
}