using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class EmeraldChecker: IAchievementChecker<WordMasteringLevelTrigger>
{
    public string Icon => "🏆";
    public string Name => "Изумруд";
    public string Description => "100 слов с бриллиантом в словаре";
    public Guid AchievementTypeId => Guid.Parse("5DF73FB3-98EF-4A39-9DBF-1E1A2D7F2ED2");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as WordMasteringLevelTrigger;
        return vocabularyEntry is { BrilliantWordsCount: >= 100 };
    }
}