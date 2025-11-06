using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.GeorgianModule.VerbsOfMovement.Lessons;

public class GeorgianVerbsLessonCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public GeorgianVerbsLessonCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson1, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson2, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson3, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson4, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson5, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson6, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson7, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson8, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson9, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianVerbsLesson10, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var (lessonTitle, lessonDescription, showPracticeButton, lessonNumber) = GetLessonContent(request.Text);

        var buttons = new List<InlineKeyboardButton[]>();
        
        // Add practice button based on lesson number
        if (showPracticeButton)
        {
            var quizCommand = lessonNumber switch
            {
                1 => CommandNames.GeorgianVerbsQuizStart1,
                2 => CommandNames.GeorgianVerbsQuizStart2,
                _ => CommandNames.GeorgianVerbsQuizStart1
            };
            
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("▶️ Начать практику", quizCommand)
            });
        }
        
        buttons.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData("⬅️ Назад к урокам", CommandNames.GeorgianVerbsOfMovement)
        });
        buttons.Add(new[]
        {
            InlineKeyboardButton.WithCallbackData("🏠 В главное меню", "/menu")
        });

        var keyboard = new InlineKeyboardMarkup(buttons.ToArray());

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"📖 {lessonTitle}\n\n{lessonDescription}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }

    private (string Title, string Description, bool ShowPracticeButton, int LessonNumber) GetLessonContent(string command)
    {
        return command switch
        {
            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson1, StringComparison.InvariantCultureIgnoreCase) =>
                ("🚶 Урок 1: Знакомство с глаголами движения",
                "🎯 Цель: выучить значения основных глаголов — идти, приходить, возвращаться, входить, выходить и т.д.\n\n" +
                "📘 Теория: Базовые глаголы движения\n" +
                "წასვლა — идти, уходить\n" +
                "მოსვლა — приходить\n" +
                "დაბრუნება — возвращаться\n" +
                "შესვლა — входить\n" +
                "გასვლა — выходить\n" +
                "ასვლა — подниматься\n" +
                "ჩასვლა — спускаться\n" +
                "გადასვლა — переходить", true, 1),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson2, StringComparison.InvariantCultureIgnoreCase) =>
                ("🚀 Урок 2. Приставки направления",
                "🎯 Цель: понимать движение по приставке (внутрь/наружу/вверх/вниз/к/от/через)\n\n" +
                "📘 Теория: Приставки направления\n" +
                "მივ- — к цели (мив-дивар, мив-ида)\n" +
                "მო- — к говорящему (мо-dис, мо-видa)\n" +
                "წა- — от говорящего (ца-видa — ушёл)\n" +
                "შე- — внутрь (ше-видa — вошёл)\n" +
                "გა- — наружу (га-видa — вышел)\n" +
                "ა- — вверх (а-видa — поднялся)\n" +
                "ჩა- — вниз (ча-vidა — спустился)\n" +
                "გად- — через (გად-ა… — გადავიდა)", true, 2),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson3, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 3. Спряжение настоящего времени",
                "На этом уроке вы изучите:\n" +
                "• Спряжение глаголов движения в настоящем времени\n" +
                "• Личные формы (я, ты, он/она, мы, вы, они)\n" +
                "• Согласование с существительными\n" +
                "• Типичные ошибки и как их избежать\n\n" +
                "Овладейте настоящим временем!", false, 3),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson4, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 4. Закрепление настоящего времени",
                "На этом уроке вы:\n" +
                "• Выполните практические упражнения\n" +
                "• Решите диалоги с глаголами движения\n" +
                "• Практикуетесь в переводе с русского на грузинский\n" +
                "• Проверите свои знания\n\n" +
                "Пора закрепить полученные знания!", false, 4),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson5, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 5. Прошедшее время (основы)",
                "На этом уроке вы изучите:\n" +
                "• Основные формы прошедшего времени\n" +
                "• Различие между простым и сложным прошедшим\n" +
                "• Образование форм прошедшего времени\n" +
                "• Примеры в контексте\n\n" +
                "Перейдем к рассказам о прошлом!", false, 5),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson6, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 6. Склонения прошедшего времени",
                "На этом уроке вы изучите:\n" +
                "• Полное спряжение прошедшего времени\n" +
                "• Все личные формы\n" +
                "• Правила согласования\n" +
                "• Отработка на примерах\n\n" +
                "Все грани прошедшего времени!", false, 6),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson7, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 7. Закрепление прошедшего",
                "На этом уроке вы:\n" +
                "• Выполните упражнения на прошедшее время\n" +
                "• Переводите предложения и тексты\n" +
                "• Создаете собственные примеры\n" +
                "• Проверяете понимание\n\n" +
                "Практикуемся в прошедшем времени!", false, 7),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson8, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 8. Будущее время (основы)",
                "На этом уроке вы изучите:\n" +
                "• Основные формы будущего времени\n" +
                "• Способы образования будущего\n" +
                "• Различие между будущим простым и сложным\n" +
                "• Примеры использования\n\n" +
                "Погляделаем в будущее!", false, 8),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson9, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 9. Склонения будущего времени",
                "На этом уроке вы изучите:\n" +
                "• Полное спряжение будущего времени\n" +
                "• Все личные формы\n" +
                "• Правильное использование в диалогах\n" +
                "• Практические задания\n\n" +
                "Все о будущем времени глаголов!", false, 9),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson10, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 10. Итоговое закрепление",
                "На этом финальном уроке вы:\n" +
                "• Повторите все три времени\n" +
                "• Решите комплексные упражнения\n" +
                "• Практикуете диалоги и переводы\n" +
                "• Проверяете полное понимание материала\n\n" +
                "Вы готовы к использованию глаголов движения в реальных ситуациях!", false, 10),

            _ => ("Урок", "Содержание урока", false, 0)
        };
    }
}