using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class PerfectionistChecker: IAchievementChecker<PerfectionistTrigger>
{
    public string Icon => "🤓";
    public string Name => " Перфекционист";
    public string Description => "Заверши на 100% квиз с как минимум 10 словами";
    public Guid AchievementTypeId => Guid.Parse("9C924814-9324-4B1C-A3D8-5724C489BFBC");

    public bool CheckAchievement(object trigger)
    {
        var perfectionistTrigger = trigger as PerfectionistTrigger;
        return perfectionistTrigger is { WordsCount: >= 10, IncorrectAnswersCount: 0 };
    }
}