namespace Domain.Entities;

public class ProcessedUpdate
{
    public int UpdateId { get; set; }
    public DateTime ProcessedAt { get; set; }
    public long UserTelegramId { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}