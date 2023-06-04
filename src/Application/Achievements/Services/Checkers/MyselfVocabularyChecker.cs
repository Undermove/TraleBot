using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Checkers;

public class MyselfVocabularyChecker: IAchievementChecker<WordMasteringLevelTrigger>
{
    public string Icon => "💎";
    public string Name => "Я и есть словарь";
    public string Description => "1000 слов с бриллиантом в словаре";
    public Guid AchievementTypeId => Guid.Parse("4B781487-8DBA-40CA-995F-DB05F6056880");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as WordMasteringLevelTrigger;
        return vocabularyEntry is { BrilliantWordsCount: >= 1000 };
    }
}