// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public long TelegramId { get; set; }
    public UserAccountType AccountType { get; set; }
    public DateTime SubscribedUntil { get; set; }
    public DateTime RegisteredAtUtc { get; set; }
    public ICollection<VocabularyEntry> VocabularyEntries { get; set; }
    public ICollection<Quiz> Quizzes { get; set; }
    public ICollection<Invoice> Invoices { get; set; }
}