namespace Domain.Entities;

// ReSharper disable once ClassNeverInstantiated.Global
// ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
public class VocabularyEntry
{
    const int MinimumSuccessAnswersRequired = 3;
    
    public required Guid Id { get; set; }
    public required string Word { get; set; }
    public required string Definition { get; set; }
    public required string AdditionalInfo { get; set; }
    public required string Example { get; set; }
    public required DateTime DateAddedUtc { get; set; }
    public required DateTime UpdatedAtUtc { get; set; }
    public Guid UserId { get; set; }
    public virtual User User { get; set; }
    public int SuccessAnswersCount { get; set; }
    public int SuccessAnswersCountInReverseDirection { get; set; }
    public int FailedAnswersCount { get; set; }
    public virtual ICollection<QuizQuestion> QuizQuestions { get; set; }
    public required Language Language { get; set; }

    public void ScorePoint(string answer)
    {
        if (answer.Equals(Definition, StringComparison.InvariantCultureIgnoreCase))
        {
            SuccessAnswersCount++;
            UpdatedAtUtc = DateTime.UtcNow;
            return;
        }
        
        if(answer.Equals(Word, StringComparison.InvariantCultureIgnoreCase))
        {
            if(SuccessAnswersCount < MinimumSuccessAnswersRequired)
            {
                UpdatedAtUtc = DateTime.UtcNow;
                return;
            }
            
            SuccessAnswersCountInReverseDirection++;
            UpdatedAtUtc = DateTime.UtcNow;
            return;
        }
        
        UpdatedAtUtc = DateTime.UtcNow;
        FailedAnswersCount++;
    }

    // null means nothing been acquired
    public MasteringLevel? GetAcquiredLevel()
    {
        if (SuccessAnswersCount >= MinimumSuccessAnswersRequired
            && SuccessAnswersCountInReverseDirection == MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.MasteredInBothDirections;
        }

        if (SuccessAnswersCount == MinimumSuccessAnswersRequired
            && SuccessAnswersCountInReverseDirection < MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.MasteredInForwardDirection;
        }
        return null;
    }
    
    public MasteringLevel GetMasteringLevel()
    {
        if (SuccessAnswersCount < MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.NotMastered;
        }

        if (SuccessAnswersCountInReverseDirection >= MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.MasteredInBothDirections;
        }

        return MasteringLevel.MasteredInForwardDirection;
    }

    public MasteringLevel? GetNextMasteringLevel()
    {
        if (SuccessAnswersCount < MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.MasteredInForwardDirection;
        }
        
        if (SuccessAnswersCount >= MinimumSuccessAnswersRequired
            && SuccessAnswersCountInReverseDirection < MinimumSuccessAnswersRequired)
        {
            return MasteringLevel.MasteredInBothDirections;
        }

        return null;
    }
    
    public int? GetScoreToNextLevel()
    {
        if (SuccessAnswersCount < MinimumSuccessAnswersRequired)
        {
            return MinimumSuccessAnswersRequired - SuccessAnswersCount;
        }

        if (SuccessAnswersCountInReverseDirection < MinimumSuccessAnswersRequired)
        {
            return MinimumSuccessAnswersRequired - SuccessAnswersCountInReverseDirection;
        }

        return null;
    }
}

public enum MasteringLevel
{
    NotMastered,
    MasteredInForwardDirection,
    MasteredInBothDirections
}