using Domain.Entities;

namespace Application.Achievements;

public class BasicSmallTalkerChecker: AchievementChecker<VocabularyEntry>
{
    public override string Icon => "🤪";
    public override string Name => "Базовый разговорник";
    public override string Description => "10 слов в словаре";
    
    public override bool CheckAchievement(VocabularyEntry entity)
    {
        return entity.User.VocabularyEntries.Count == 10;
    }
}