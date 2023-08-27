namespace Application.Achievements.Queries;

public class AchievementsListVm
{
    public int VocabularyEntriesCount { get; init; }
    public int MasteredInForwardDirectionProgress { get; init; }
    public int MasteredInBothDirectionProgress { get; init; }
    public required IList<AchievementVm> Achievements { get; init; }
}