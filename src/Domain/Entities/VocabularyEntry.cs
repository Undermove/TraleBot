namespace Domain.Entities;

// ReSharper disable once ClassNeverInstantiated.Global
public class VocabularyEntry
{
    const int MinimumSuccessAnswersRequired = 3;
    
    public Guid Id { get; set; }
    public string Word { get; set; }
    public string Definition { get; set; }
    public string AdditionalInfo { get; set; }
    public DateTime DateAdded { get; set; } 
    public Guid UserId { get; set; }
    public User User { get; set; }
    public int SuccessAnswersCount { get; set; }
    public int SuccessAnswersCountInReverseDirection { get; set; }
    public int FailedAnswersCount { get; set; }
    public ICollection<QuizQuestion> QuizQuestions { get; set; }

    public void ScorePoint(string answer)
    {
        if (answer.Equals(Definition, StringComparison.InvariantCultureIgnoreCase))
        {
            SuccessAnswersCount++;
        }
        else if(answer.Equals(Word, StringComparison.InvariantCultureIgnoreCase))
        {
            SuccessAnswersCountInReverseDirection++;
        }
        else
        {
            FailedAnswersCount++;
        }
    }
    
    public MasteringLevel GetMasteringLevel()
    {
        if (SuccessAnswersCount < MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.NotMastered;
        }

        return MasteringLevel.MasteredInForwardDirection;
    }
    
    public int GetScoreToNextLevel()
    {
        return MinimumSuccessAnswersRequired - SuccessAnswersCount;
    }
}

public enum MasteringLevel
{
    NotMastered,
    MasteredInForwardDirection,
    MasteredInBothDirections
}