using Domain.Entities;

namespace Application.Achievements;

public class BasicSmallTalkerChecker: IAchievementChecker<VocabularyEntry>
{
    public string Icon => "🤪";
    public string Name => "Базовый разговорник";
    public string Description => "10 слов в словаре";
    
    public bool CheckAchievement(object entity)
    {
        var vocabularyEntry = entity as VocabularyEntry;
        return vocabularyEntry.User.VocabularyEntries.Count == 10;
    }
}