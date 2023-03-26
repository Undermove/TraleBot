using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class KingOfScoreChecker: IAchievementChecker<GoldMedalsTrigger>
{
    public string Icon => "🥇";
    public string Name => "Король зачёта";
    public string Description => "1000 слов с золотой медалью";
    public Guid AchievementTypeId => Guid.Parse("9E98E35C-4ACF-47C9-A254-6661170EF6EF");

    public bool CheckAchievement(object trigger)
    {
        var kingOfScoreTrigger = trigger as GoldMedalsTrigger;
        return kingOfScoreTrigger is { GoldMedalWordsCount: >= 1000 };
    }
}