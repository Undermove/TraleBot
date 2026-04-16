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
    public string? SuccessfulPaymentCurrency { get; }
    public string? SuccessfulPaymentChargeId { get; }
    public string? SuccessfulPaymentPayload { get; }
    public int? SuccessfulPaymentAmount { get; }

    public TelegramRequest(Update request, User? user)
    {
        UserTelegramId = request.Message?.From?.Id
                         ?? request.CallbackQuery?.From.Id
                         ?? request.MyChatMember?.From.Id
                         ?? request.PreCheckoutQuery?.From.Id
                         ?? throw new ArgumentException("User TelegramId not found");
        MessageId = GetMessageId(request);
        Text = GetMessageText(request); // bad hack to skip empty message when bot reacts to his own message
        UserName = request.Message?.Chat.FirstName
                   ?? request.CallbackQuery?.From.FirstName
                   ?? request.PreCheckoutQuery?.From.FirstName
                   ?? request.MyChatMember?.From.FirstName
                   ?? throw new ArgumentException("User Name not found");
        User = user;
        RequestType = request.Type;
        InvoicePayload = request.PreCheckoutQuery?.InvoicePayload ?? "";
        SuccessfulPaymentCurrency = request.Message?.SuccessfulPayment?.Currency;
        SuccessfulPaymentChargeId = request.Message?.SuccessfulPayment?.TelegramPaymentChargeId;
        SuccessfulPaymentPayload = request.Message?.SuccessfulPayment?.InvoicePayload;
        SuccessfulPaymentAmount = (int?)request.Message?.SuccessfulPayment?.TotalAmount;
    }

    private static string GetMessageText(Update request)
    {
        if(request.MyChatMember is { NewChatMember.Status: ChatMemberStatus.Kicked })
        {
            return CommandNames.Stop;
        }

        if (request.Message?.SuccessfulPayment != null)
        {
            return $"successful_payment:{request.Message.SuccessfulPayment.Currency}";
        }

        return request.Message?.Text
               ?? request.CallbackQuery?.Data
               ?? request.PreCheckoutQuery?.Id
               ?? "/";
    }

    private static int GetMessageId(Update request)
    {
        if (request.Type == UpdateType.PreCheckoutQuery)
        {
            return 0;
        }

        if (request.Type == UpdateType.MyChatMember)
        {
            return 0;
        }

        return request.Message?.MessageId
               ?? request.CallbackQuery?.Message?.MessageId
               ?? throw new ArgumentException("MessageId not found");
    }
}