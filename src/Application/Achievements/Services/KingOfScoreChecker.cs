using Domain.Entities;

namespace Application.Achievements.Services;

public class KingOfScoreChecker: IAchievementChecker<VocabularyEntry>
{
    public string Icon => "🥇";
    public string Name => "Король зачёта";
    public string Description => "1000 слов с золотой медалью";
    public Guid AchievementTypeId => Guid.Parse("F6A17206-C0AC-4C76-9A3B-20F5F9DB68CF");

    public bool CheckAchievement(object trigger)
    {
        return true;
    }
}