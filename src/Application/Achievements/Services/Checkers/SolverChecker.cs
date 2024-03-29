using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Checkers;

public class SolverChecker: IAchievementChecker<PerfectQuizTrigger>
{
    public string Icon => "✅";
    public string Name => "Решала";
    public string Description => "Пройди на 100% квиз за неделю с 30 словами";
    public Guid AchievementTypeId => Guid.Parse("BE888655-F388-4823-B720-0B79B86CFCC3");

    public bool CheckAchievement(object trigger)
    {
        var solverTrigger = trigger as PerfectQuizTrigger;
        return solverTrigger is { WordsCount: >= 30, IncorrectAnswersCount: 0 };
    }
}