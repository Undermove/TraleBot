using Application.Users.Commands.CreateUser;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class AchievementsCommand : IBotCommand
{
    private readonly TelegramBotClient _client;

    public AchievementsCommand(TelegramBotClient client)
    {
        _client = client;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Achievements));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        string achievementsMessage = """
    📊Статистика словаря:

    ✅Новые слова:
    Текущая серия: <b>10 дней</b>
    Максимальная серия: <b>12 дней</b>

    🎲Квизы каждый день:
    Текущая серия: <b>10 дней</b>
    Максимальная серия: <b>12 дней</b>

    <b>Достижения:</b>
    🤪 Базовый разговорник – 10 слов в словаре
     
    🗣 Прокачанный болтун – 100 слов в словаре
      
    🧑‍🎓 Юный эрудит – 1000 слов в словаре
     
    ⭐ Начинающий квизёр – пройди свой первый квиз
     
    🤓 Перфекционист – заверши на 100% квиз с как минимум 10 словами.
     
    ✅ Решала – пройди на 100% квиз за неделю с 30 словами.
     
    ❓ Я только спросить – перевести слово, но не добавлять его в словарь
     
    😤 Сам знаю – перевести слово вручную
     
    🥉 Медалист – 10 слов с золотой медалью
     
    🥈 Серебряный призер – 100 слов с золотой медалью
     
    🥇 Король зачёта – 1000 слов с золотой медалью
     
    🏵 Аметист – 10 слов с бриллиантом в словаре
     
    🏆 Изумруд – 100 слов с бриллиантом в словаре
     
    💎 Я и есть словарь – 1000 слов с бриллиантом в словаре
    """;
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            achievementsMessage,
            replyMarkup: MenuKeyboard.GetMenuKeyboard(),
            parseMode: ParseMode.Html,
            cancellationToken: token);
    }
}