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
    
    public TelegramRequest(Update request, Guid? userId)
    {
        UserTelegramId = request.Message?.From?.Id 
                         ?? request.CallbackQuery?.From.Id 
                         ?? request.MyChatMember?.From.Id 
                         ?? request.PreCheckoutQuery?.From.Id 
                         ?? throw new ArgumentException();
        MessageId = request.Type == UpdateType.PreCheckoutQuery ? 0 : request.Message?.MessageId 
                                                                    ?? request.CallbackQuery?.Message?.MessageId
                                                                    ?? throw new ArgumentException();
        Text = request.Message?.Text
               ?? request.CallbackQuery?.Data 
               ?? "";
        UserName = request.Message?.Chat.FirstName 
                   ?? request.CallbackQuery?.From.Username 
                   ?? request.PreCheckoutQuery?.From.Username 
                   ?? throw new ArgumentException();
        UserId = userId;
    }
}