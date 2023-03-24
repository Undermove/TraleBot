using Domain.Entities;

namespace Application.Achievements.Services;

public class YoungEggheadChecker: IAchievementChecker<VocabularyEntry>
{
    public string Icon => "🧑‍🎓";
    public string Name => "Юный эрудит ";
    public string Description => "1000 слов в словаре";
    public Guid AchievementTypeId => Guid.Parse("F6A17206-C0AC-4C76-9A3B-20F5F9DB68CF");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as VocabularyEntry;
        return vocabularyEntry is { User.VocabularyEntries.Count: >= 1000 };
    }
}