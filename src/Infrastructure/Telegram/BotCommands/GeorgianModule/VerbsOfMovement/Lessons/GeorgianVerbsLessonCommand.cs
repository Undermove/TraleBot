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
                3 => CommandNames.GeorgianVerbsQuizStart3,
                4 => CommandNames.GeorgianVerbsQuizStart4,
                5 => CommandNames.GeorgianVerbsQuizStart5,
                6 => CommandNames.GeorgianVerbsQuizStart6,
                7 => CommandNames.GeorgianVerbsQuizStart7,
                8 => CommandNames.GeorgianVerbsQuizStart8,
                9 => CommandNames.GeorgianVerbsQuizStart9,
                10 => CommandNames.GeorgianVerbsQuizStart10,
                _ => CommandNames.GeorgianVerbsQuizStart1
            };
            
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("▶ Начать практику", quizCommand)
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
            _ when command.Equals(CommandNames.GeorgianVerbsLesson1, StringComparison.InvariantCultureIgnoreCase) =>
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
                ("Урок 3. Спряжение глаголов движения (настоящее время)",
                "🎯 Цель: научиться спрягать глаголы движения по лицам (я, ты, он…)\n" +
                "и понимать разницу между «к говорящему» (მოვდივარ) и «от говорящего» (მივდივარ)\n\n" +
                "📖 Теория: Настоящее время глаголов движения\n" +
                "Основная структура:\n" +
                "приставка + действие (დივ/დიხ/დის) + окончание\n\n" +
                "Примеры:\n" +
                "Лицо │ идти (მი-) │ приходить (მო-)\n" +
                "─────────────────────────────────\n" +
                "მე │ მივდივარ │ მოვდივარ\n" +
                "შენ │ მიდიხარ │ მოდიხარ\n" +
                "ის │ მიდის │ მოდის\n" +
                "ჩვენ │ მივდივართ │ მოვდივართ\n" +
                "თქვენ │ მიდიხართ │ მოდიხართ\n" +
                "ისინი │ მიდიან │ მოდიან\n\n" +
                "მი- — «от говорящего»   მო- — «к говорящему»\n" +
                "შე- — «внутрь»   გა- — «наружу»   ა- — «вверх»   ჩა- — «вниз»   გად- — «через»", true, 3),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson4, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 4. Закрепление настоящего времени",
                "🎯 Цель: автоматизировать выбор форм настоящего времени по лицам и направлениям.\n\n" +
                "📖 Теория: кратко\n" +
                "Настоящее: приставка направления + დივ/დიხ/დის + окончание.\n" +
                "Направления: მი (от говорящего) / მო (к говорящему) / შე (внутрь) / გა (наружу) / ა (вверх) / ჩა (вниз) / გად (через).\n" +
                "Пример: მე მივდივარ, შენ მოდიხარ, ის შედის.", true, 4),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson5, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 5. Прошедшее время (основы)",
                "🎯 Цель: познакомиться с базовыми прошедшими формами глаголов движения.\n\n" +
                "📖 Теория: кратко\n" +
                "Прошедшее: используем типовые формы прошедшей серии для глаголов движения.\n" +
                "Фокус на понимании ‘к/от говорящего’ и направлений შე/გა/ა/ჩა/გად в прошедшем.\n" +
                "Пример-набросок: ‘вошёл/вышел/поднялся/спустился/перешёл’.", true, 5),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson6, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 6. Склонения прошедшего времени",
                "🎯 Цель: закрепить прошедшее время во всех лицах и числах.\n\n" +
                "📖 Теория: кратко\n" +
                "Повтори лица/числа в прошедшем: ед. (1/2/3) и мн. (1/2/3).\n" +
                "Обращай внимание на постпозиции места: …ში (в), …დან (из), …ზე (на), …თან (к).", true, 6),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson7, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 7. Закрепление прошедшего",
                "🎯 Цель: проверить и укрепить распознавание и подстановку форм в прошедшем.\n\n" +
                "📖 Теория: кратко\n" +
                "Микс направлений и лиц в прошедшем.\n" +
                "Появятся ‘ловушки’ с близкими формами — будь внимателен к контексту.", true, 7),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson8, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 8. Будущее время (основы)",
                "🎯 Цель: познакомиться с базовыми будущими формами глаголов движения.\n\n" +
                "📖 Теория: кратко\n" +
                "Будущее: типовые будущие формы глаголов движения; планы/намерения.\n" +
                "Контекст: завтра, позже, по расписанию.", true, 8),

            _ when command.StartsWith(CommandNames.GeorgianVerbsLesson9, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 9. Склонения будущего времени",
                "🎯 Цель: закрепить будущее время во всех лицах и числах.\n\n" +
                "📖 Теория: кратко\n" +
                "Тренируем 6 лиц в будущем, включая групповые формы.\n" +
                "Контексты: планы/встречи/расписание.", true, 9),

            _ when command.Equals(CommandNames.GeorgianVerbsLesson10, StringComparison.InvariantCultureIgnoreCase) =>
                ("Урок 10. Итоговое закрепление",
                "🎯 Цель: свести воедино настоящее, прошедшее и будущее по глаголам движения.\n\n" +
                "📖 Теория: кратко\n" +
                "Узнаём время по контексту (сейчас/вчера/завтра) и по форме.\n" +
                "Смешанные задания на направления и лица.", true, 10),

            _ => ("Урок", "Содержание урока", false, 0)
        };
    }
}