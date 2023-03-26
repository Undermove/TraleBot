using Application.Achievements;
using Application.Achievements.Queries;
using Application.Users.Commands.CreateUser;
using Domain.Entities;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.BotCommands;

public class AchievementsCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private IMediator _mediator;

    public AchievementsCommand(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.Achievements));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var achievementsVm = await _mediator.Send(new GetAchievementsQuery { UserId = request.User!.Id }, token);
        string GetAchievementIcon(bool isUnlocked, string icon) => isUnlocked ? icon : "🚫";
        
        var achievementsStrings = achievementsVm.Achievements
            .Select(achievement => $@"{GetAchievementIcon(achievement.IsUnlocked, achievement.Icon)} {achievement.Name} – {achievement.Description}");
        var achievementsMessageHeader = "📊<b>Твои достижения:</b>\r\n\r\n";
        var achievementsMessage = string.Join("\r\n\r\n", achievementsStrings);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"{achievementsMessageHeader}{achievementsMessage}",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(),
            parseMode: ParseMode.Html,
            cancellationToken: token);
    }
}