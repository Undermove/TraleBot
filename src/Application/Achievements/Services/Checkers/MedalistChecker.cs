using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class MedalistChecker: IAchievementChecker<GoldMedalsTrigger>
{
    public string Icon => "🥉";
    public string Name => "Медалист";
    public string Description => "10 слов с золотой медалью";
    public Guid AchievementTypeId => Guid.Parse("574316E8-E3BA-4BD1-92DB-61409C85E0ED");
    public bool CheckAchievement(object trigger)
    {
        var kingOfScoreTrigger = trigger as GoldMedalsTrigger;
        return kingOfScoreTrigger is { GoldMedalWordsCount: >= 10 };
    }
}