using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class JustAskChecker: IAchievementChecker<RemoveWordTrigger>
{
    public string Icon => "❓";
    public string Name => "Я только спросить";
    public string Description => "перевести слово, но не добавлять его в словарь";
    public Guid AchievementTypeId => Guid.Parse("A239A83C-79A9-425E-A4B5-6BC47189611D");

    public bool CheckAchievement(object trigger)
    {
        return true;
    }
}