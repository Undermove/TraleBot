namespace Application.Common;

public interface ITelegramMessageSender
{
    Task<bool> SendTextAsync(long telegramId, string text, bool includeMiniAppButton, CancellationToken ct);
}
