using Application.Achievements.Queries;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class AchievementsCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public AchievementsCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.Contains(CommandNames.Achievements) || 
            commandPayload.StartsWith(CommandNames.AchievementsIcon));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var achievementsVm = await _mediator.Send(new GetAchievementsQuery { UserId = request.User!.Id }, token);
        string GetAchievementIcon(bool isUnlocked, string icon) => isUnlocked ? icon : "🚫";
        
        var achievementsStrings = achievementsVm.Achievements
            .Select(achievement => $"{GetAchievementIcon(achievement.IsUnlocked, achievement.Icon)} {achievement.Name} – {achievement.Description}");
        var achievementsMessageHeader = "📊<b>Твои достижения:</b>";
        var achievementsMessage = string.Join("\r\n\r\n", achievementsStrings);
        
        var statisticsMessageHeader = "📈<b>Статистика:</b>";
        var statistics = $"Слов в словаре: {achievementsVm.VocabularyEntriesCount}\r\n" +
                         $"Закреплено на 🥇: {achievementsVm.MasteredInForwardDirectionProgress}\r\n" +
                         $"Закреплено на 💎: {achievementsVm.MasteredInBothDirectionProgress}";
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"{statisticsMessageHeader}\r\n{statistics}\r\n\r\n{achievementsMessageHeader}\r\n\r\n{achievementsMessage}",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(),
            parseMode: ParseMode.Html,
            cancellationToken: token);
    }
}