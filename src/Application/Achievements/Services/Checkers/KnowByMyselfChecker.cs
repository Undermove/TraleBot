using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class KnowByMyselfChecker: IAchievementChecker<ManualTranslationTrigger>
{
    public string Icon => "😤";
    public string Name => "Сам знаю";
    public string Description => "перевести слово вручную";
    public Guid AchievementTypeId => Guid.Parse("F3F07800-DD7F-4321-9882-AC4A1D635E3E");

    public bool CheckAchievement(object trigger)
    {
        return trigger is ManualTranslationTrigger;
    }
}