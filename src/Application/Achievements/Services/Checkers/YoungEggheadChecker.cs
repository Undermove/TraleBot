using Domain.Entities;

namespace Application.Achievements.Services.Checkers;

public class YoungEggheadChecker: IAchievementChecker<VocabularyEntry>
{
    public string Icon => "🧑‍🎓";
    public string Name => "Юный эрудит ";
    public string Description => "1000 слов в словаре";
    public Guid AchievementTypeId => Guid.Parse("11E60C28-A6F5-4E91-9E96-0F8CCEAD5C9A");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as VocabularyEntry;
        return vocabularyEntry is { User.VocabularyEntries.Count: >= 1000 };
    }
}