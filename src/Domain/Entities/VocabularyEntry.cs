namespace Domain.Entities;

// ReSharper disable once ClassNeverInstantiated.Global
public class VocabularyEntry
{
    public Guid Id { get; set; }
    public string Word { get; set; }
    public string Definition { get; set; }
    public DateTime DateAdded { get; set; } 
    public Guid UserId { get; set; }
    public User User { get; set; }
}