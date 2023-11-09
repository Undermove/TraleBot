using Application.Quizzes.Commands;
using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class StopQuizBotCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public StopQuizBotCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Equals(CommandNames.StopQuiz) ||
                               commandPayload.StartsWith(CommandNames.StopQuizIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await _mediator.Send(new StopQuizCommand {UserId = request.User!.Id}, token);
        var keyboard = new ReplyKeyboardRemove();
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"Хорошо, пока закончим этот квиз. 😌",
            replyMarkup: keyboard,
            cancellationToken: token);
        
        await _client.SendTextMessageAsync(
            request.UserTelegramId,
            $"{CommandNames.MenuIcon} Меню",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(request.User.Settings.CurrentLanguage),
            cancellationToken: token);
    }
}