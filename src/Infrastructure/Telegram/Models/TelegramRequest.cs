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
    public UpdateType RequestType { get; }
    
    public TelegramRequest(Update request, Guid? userId)
    {
        UserTelegramId = request.Message?.From?.Id 
                         ?? request.CallbackQuery?.From.Id 
                         ?? request.MyChatMember?.From.Id 
                         ?? request.PreCheckoutQuery?.From.Id 
                         ?? throw new ArgumentException("User TelegramId not found");
        MessageId = request.Type == UpdateType.PreCheckoutQuery ? 0 : request.Message?.MessageId 
                                                                    ?? request.CallbackQuery?.Message?.MessageId
                                                                    ?? throw new ArgumentException("MessageId not found");
        Text = request.Message?.Text
               ?? request.CallbackQuery?.Data
               ?? request.PreCheckoutQuery?.Id
               ?? "/"; // bad hack to skip empty message when bot reacts to his own message
        UserName = request.Message?.Chat.FirstName 
                   ?? request.CallbackQuery?.From.FirstName 
                   ?? request.PreCheckoutQuery?.From.FirstName 
                   ?? throw new ArgumentException("User Name not found");
        UserId = userId;
        RequestType = request.Type;
    }
}