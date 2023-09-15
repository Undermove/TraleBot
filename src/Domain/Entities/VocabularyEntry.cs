namespace Domain.Entities;

// ReSharper disable once ClassNeverInstantiated.Global
// ReSharper disable once ClassWithVirtualMembersNeverInherited.Global
public class VocabularyEntry
{
    const int MinimumSuccessAnswersRequired = 3;
    
    public Guid Id { get; set; }
    public string Word { get; set; }
    public string Definition { get; set; }
    public string AdditionalInfo { get; set; }
    public string Example { get; set; }
    public DateTime DateAdded { get; set; } // rename to DateAddedUtc 
    public Guid UserId { get; set; }
    public virtual User User { get; set; }
    public int SuccessAnswersCount { get; set; }
    public int SuccessAnswersCountInReverseDirection { get; set; }
    public int FailedAnswersCount { get; set; }
    public virtual ICollection<QuizQuestion> QuizQuestions { get; set; }

    public MasteringLevel? ScorePoint(string answer)
    {
        if (answer.Equals(Definition, StringComparison.InvariantCultureIgnoreCase))
        {
            SuccessAnswersCount++;
            if (SuccessAnswersCount == MinimumSuccessAnswersRequired)
            {
                return MasteringLevel.MasteredInForwardDirection;
            }

            return null;
        }
        
        if(answer.Equals(Word, StringComparison.InvariantCultureIgnoreCase))
        {
            SuccessAnswersCountInReverseDirection++;
            if (SuccessAnswersCountInReverseDirection == MinimumSuccessAnswersRequired)
            {
                return MasteringLevel.MasteredInBothDirections;
            }
            
            return null;
        }
        
        FailedAnswersCount++;
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