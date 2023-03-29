using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class YoungEggheadChecker: IAchievementChecker<VocabularyCountTrigger>
{
    public string Icon => "🧑‍🎓";
    public string Name => "Юный эрудит";
    public string Description => "1000 слов в словаре";
    public Guid AchievementTypeId => Guid.Parse("11E60C28-A6F5-4E91-9E96-0F8CCEAD5C9A");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as VocabularyCountTrigger;
        return vocabularyEntry is { VocabularyEntriesCount: >= 1000 };
    }
}