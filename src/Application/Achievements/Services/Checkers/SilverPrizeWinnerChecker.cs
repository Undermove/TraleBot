using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class SilverPrizeWinnerChecker: IAchievementChecker<GoldMedalsTrigger>
{
    public string Icon => "🥈";
    public string Name => "Серебряный призер";
    public string Description => "100 слов с золотой медалью";
    public Guid AchievementTypeId => Guid.Parse("93B95A13-2CEB-4124-9ECB-50BE40DD8008");

    public bool CheckAchievement(object trigger)
    {
        if (trigger is not GoldMedalsTrigger kingOfScoreTrigger)
        {
            return false;
        }
        
        var medalWordsCount = kingOfScoreTrigger.GoldMedalWordsCount + kingOfScoreTrigger.BrilliantWordsCount;
        return medalWordsCount >= 100;
    }
}