using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.Telegram.Models;

public class TelegramRequest
{
    public int MessageId { get; }
    public long UserTelegramId { get; }
    public Guid? UserId { get; }
    public string Text { get; }
    public string UserName { get; }
    public UpdateType MessageType { get; }
    
    public TelegramRequest(Update request, Guid? userId)
    {
        UserTelegramId = request.Message?.From?.Id ?? request.CallbackQuery?.From.Id ?? throw new ArgumentException();
        MessageId = request.Message?.MessageId ?? request.CallbackQuery?.Message?.MessageId ?? throw new ArgumentException();
        Text = request.Message?.Text ?? request.CallbackQuery?.Data ?? throw new ArgumentException();
        UserName = request.Message?.Chat.FirstName ?? request.CallbackQuery?.From.Username ?? throw new ArgumentException();
        UserId = userId;
        MessageType = request.Type;
    }
}