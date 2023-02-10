using Application.Users.Commands;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.PaymentCommands;

public class ActivateTrialCommand : IBotCommand
{
    private readonly TelegramBotClient _client;
    private readonly ILogger _logger;
    private readonly IMediator _mediator;

    public ActivateTrialCommand(TelegramBotClient client, ILoggerFactory logger, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
        _logger = logger.CreateLogger(typeof(PayCommand));
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ActivateTrial, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        _logger.LogInformation("User with ID: {id} requested trial", request.User!.Id);

        var result = await _mediator.Send(new ActivatePremiumCommand
        {
            UserId = request.User.Id,
            InvoiceCreatedAdUtc = DateTime.UtcNow,
            IsTrial = true
        }, token);

        if (result == PremiumActivationStatus.Success)
        {
            await _client.EditMessageTextAsync(
                request.UserTelegramId,
                request.MessageId,
                "🎉Спасибо за активацию триала! Чтобы начать разблокированный квиз пришлите /quiz",
                cancellationToken: token);
            _logger.LogInformation("Trial activated for user with ID: {id}", request.User!.Id);
        }
        else
        {
            _logger.LogInformation("Trial ended for user with ID: {id}", request.User!.Id);
            var keyboard = new InlineKeyboardMarkup(new[]
            {
                new[] { InlineKeyboardButton.WithCallbackData("💳 Год премиума. За 180 рублей", $"{CommandNames.Pay}") }
            });
        
            await _client.SendTextMessageAsync(
                request.UserTelegramId, 
                "🏁Твой триальный период подошел к концу. Ты можешь продолжить пользоваться функциями премиума оплатив год работы. " +
                "\r\n😇У нас не нужно привязывать карту. Никаких внезапных списаний по подпискам!",
                replyMarkup: keyboard,
                cancellationToken: token);
        }
    }
}