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
    public int SuccessAnswersCount { get; set; }
    public int FailedAnswersCount { get; set; }
    public IList<QuizVocabularyEntry> QuizVocabularyEntries { get; set; }

    public MasteringLevel GetMasteringLevel()
    {
        if (SuccessAnswersCount <= FailedAnswersCount || SuccessAnswersCount <= 3)
        {
            return MasteringLevel.NotMastered;
        }

        return MasteringLevel.MasteredInForwardDirection;
    } 
}

public enum MasteringLevel
{
    NotMastered,
    MasteredInForwardDirection,
    MasteredInBothDirections
}