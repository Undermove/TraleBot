namespace Infrastructure.Telegram.Models;

public interface IBotCommand
{
    Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct);
    Task Execute(TelegramRequest request, CancellationToken token);
}