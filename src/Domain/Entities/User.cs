// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public long TelegramId { get; set; }
    public ICollection<VocabularyEntry> VocabularyEntries { get; set; }
    public ICollection<Quiz> Quizzes { get; set; }
}