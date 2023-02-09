using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using User = Domain.Entities.User;

namespace Infrastructure.Telegram.Models;

public class TelegramRequest
{
    public int MessageId { get; }
    public long UserTelegramId { get; }
    public User? User { get; }
    public string Text { get; }
    public string UserName { get; }
    public UpdateType RequestType { get; }
    public string InvoicePayload { get; }
    
    public TelegramRequest(Update request, User? user)
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
        User = user;
        RequestType = request.Type;
        InvoicePayload = request.PreCheckoutQuery?.InvoicePayload ?? "";
    }
}