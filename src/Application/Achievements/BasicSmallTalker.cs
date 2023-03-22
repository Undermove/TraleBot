using Domain.Entities;

namespace Application.Achievements;

public class BasicSmallTalkerChecker: IAchievementChecker<VocabularyEntry>
{
    public string Icon => "🤪";
    public string Name => "Базовый разговорник";
    public string Description => "10 слов в словаре";
    public Guid AchievementTypeId => Guid.Parse("67026C84-99ED-44EA-9CB5-7E83D569E80C");

    public bool CheckAchievement(object entity)
    {
        var vocabularyEntry = entity as VocabularyEntry;
        return vocabularyEntry is { User.VocabularyEntries.Count: >= 10 };
    }
}