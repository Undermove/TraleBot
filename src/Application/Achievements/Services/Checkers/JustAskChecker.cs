using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Checkers;

public class JustAskChecker: IAchievementChecker<RemoveWordTrigger>
{
    public string Icon => "❓";
    public string Name => "Я только спросить";
    public string Description => "Перевести слово, но не добавлять его в словарь";
    public Guid AchievementTypeId => Guid.Parse("A239A83C-79A9-425E-A4B5-6BC47189611D");

    public bool CheckAchievement(object trigger)
    {
        return trigger is RemoveWordTrigger;
    }
}