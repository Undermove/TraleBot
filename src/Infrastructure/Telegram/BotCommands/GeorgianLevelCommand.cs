using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands;

public class GeorgianLevelCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;

    public GeorgianLevelCommand(ITelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.StartsWith(CommandNames.GeorgianA1, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianA2, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianB1, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianB2, StringComparison.InvariantCultureIgnoreCase) ||
            commandPayload.StartsWith(CommandNames.GeorgianC1, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var (levelTitle, levelDescription) = GetLevelContent(request.Text);

        var keyboard = new InlineKeyboardMarkup(new InlineKeyboardButton[][]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("⬅️ Назад", CommandNames.GeorgianLevelsMenu)
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🏠 В главное меню", "/menu")
            }
        });

        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            $"🇬🇪 {levelTitle}\n\n{levelDescription}",
            replyMarkup: keyboard,
            cancellationToken: token);
    }

    private (string Title, string Description) GetLevelContent(string command)
    {
        return command switch
        {
            _ when command.StartsWith(CommandNames.GeorgianA1, StringComparison.InvariantCultureIgnoreCase) =>
                ("A1 — Буквы и основы речи",
                "На этом уровне вы изучите:\n" +
                "• Грузинский алфавит (мхедрули)\n" +
                "• Основные фразы приветствия\n" +
                "• Простые вопросы и ответы\n" +
                "• Числа и дни недели\n" +
                "• Базовые глаголы \"быть\" и \"иметь\"\n\n" +
                "Это идеальное место для начинающих!"),

            _ when command.StartsWith(CommandNames.GeorgianA2, StringComparison.InvariantCultureIgnoreCase) =>
                ("A2 — Простые фразы и глаголы движения",
                "На этом уровне вы изучите:\n" +
                "• Глаголы движения (идти, бежать, прийти)\n" +
                "• Предложения в настоящем времени\n" +
                "• Описание людей и предметов\n" +
                "• Повседневные фразы\n" +
                "• Основные предлоги\n\n" +
                "Продолжаем развивать базовые навыки!"),

            _ when command.StartsWith(CommandNames.GeorgianB1, StringComparison.InvariantCultureIgnoreCase) =>
                ("B1 — Разговорный уровень",
                "На этом уровне вы изучите:\n" +
                "• Диалоги в повседневных ситуациях\n" +
                "• Прошедшее и будущее время\n" +
                "• Более сложные грамматические структуры\n" +
                "• Выражение мнения и эмоций\n" +
                "• Рассказывание историй\n\n" +
                "Пора поговорить как настоящий говорящий!"),

            _ when command.StartsWith(CommandNames.GeorgianB2, StringComparison.InvariantCultureIgnoreCase) =>
                ("B2 — Продвинутая грамматика",
                "На этом уровне вы изучите:\n" +
                "• Сложные времена глаголов\n" +
                "• Условные предложения\n" +
                "• Пассивный залог\n" +
                "• Причастия и деепричастия\n" +
                "• Специализированную лексику\n\n" +
                "Уже близко к уровню свободного владения!"),

            _ when command.StartsWith(CommandNames.GeorgianC1, StringComparison.InvariantCultureIgnoreCase) =>
                ("C1 — Идиомы и речь как у носителя",
                "На этом уровне вы изучите:\n" +
                "• Идиоматические выражения\n" +
                "• Тонкие грамматические нюансы\n" +
                "• Культурные особенности языка\n" +
                "• Профессиональную лексику\n" +
                "• Художественные тексты\n\n" +
                "Вы достигли уровня носителя языка!"),

            _ => ("Уровень грузинского", "Содержание уровня")
        };
    }
}