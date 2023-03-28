using Application.Common.Interfaces;
using Domain.Entities;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.Services;

public class TelegramNotificationService: IUserNotificationService
{
    private readonly TelegramBotClient _client;
    private readonly IMediator _mediator;

    public TelegramNotificationService(TelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public async Task NotifyAboutUnlockedAchievementAsync(Achievement achievement, CancellationToken ct)
    {
        await _client.SendTextMessageAsync(
            0,
            "✅Платеж принят. Спасибо за поддержку нашего бота! Вам доступны дополнительные фичи.",
            cancellationToken: ct);
    }
}