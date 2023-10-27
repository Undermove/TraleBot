// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public long TelegramId { get; set; }
    public UserAccountType AccountType { get; set; }
    public DateTime? SubscribedUntil { get; set; }
    public DateTime RegisteredAtUtc { get; set; }
    public Guid UserSettingsId { get; set; }
    public virtual UserSettings Settings { get; set; }
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; }
    public virtual ICollection<Quiz> Quizzes { get; set; }
    public virtual ICollection<Invoice> Invoices { get; set; }
    public virtual ICollection<Achievement> Achievements { get; set; }
    public virtual ICollection<ShareableQuiz> ShareableQuizzes { get; set; }
    
    public bool IsActivePremium()
    {
        return AccountType == UserAccountType.Premium && SubscribedUntil!.Value.Date > DateTime.UtcNow;
    }
}