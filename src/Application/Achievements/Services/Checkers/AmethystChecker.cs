using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Checkers;

public class AmethystChecker: IAchievementChecker<WordMasteringLevelTrigger>
{
    public string Icon => "🏵";
    public string Name => "Аметист";
    public string Description => "10 слов с бриллиантом в словаре";
    public Guid AchievementTypeId => Guid.Parse("ABD909BB-926C-4F73-8AF9-61286468F6AB");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as WordMasteringLevelTrigger;
        return vocabularyEntry is { BrilliantWordsCount: >= 10 };
    }
}