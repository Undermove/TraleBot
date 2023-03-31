using Application.Achievements.Services.Triggers;

namespace Application.Achievements.Services.Checkers;

public class StartingQuizzerChecker: IAchievementChecker<StartingQuizzerTrigger>
{
    public string Icon => "⭐";
    public string Name => "Начинающий квизёр";
    public string Description => "Пройди свой первый квиз";
    public Guid AchievementTypeId => Guid.Parse("17C01839-E138-4E9A-A81C-D456A26FF3F0");

    public bool CheckAchievement(object trigger)
    {
        var vocabularyEntry = trigger as StartingQuizzerTrigger;
        return vocabularyEntry is { QuizzesCount: >= 1 };
    }
}