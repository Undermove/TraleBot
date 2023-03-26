using Application.Achievements.Services.Triggers;
using Domain.Entities;

namespace Application.Achievements.Services.Checkers;

public class BasicSmallTalkerChecker: IAchievementChecker<VocabularyCountTrigger>
{
    public string Icon => "🤪";
    public string Name => "Базовый разговорник";
    public string Description => "10 слов в словаре";
    public Guid AchievementTypeId => Guid.Parse("67026C84-99ED-44EA-9CB5-7E83D569E80C");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as VocabularyCountTrigger;
        return vocabularyEntry is { VocabularyEntriesCount: >= 10 };
    }
}