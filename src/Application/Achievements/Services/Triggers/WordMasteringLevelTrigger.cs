using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Triggers;

public class WordMasteringLevelTrigger: IAchievementTrigger
{
    public required int GoldMedalWordsCount { get; init; }
    
    public required int BrilliantWordsCount { get; init; }
}