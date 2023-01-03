namespace Application.Common.Models;

public interface IMessengerRequest
{
    public int MessageId { get; }
    public long UserTelegramId { get; }
    public string Text { get; }
    public string UserName { get; }
}