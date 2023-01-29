namespace Domain.Entities;

public class Invoice
{
    public Guid Id { get; set; }
    public string PreCheckoutQueryId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    
    public Guid UserId { get; set; }
    public User User { get; set; }
}