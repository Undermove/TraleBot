namespace Application.Achievements.Queries;

public class AchievementsListVm
{
    public required IList<AchievementVm> Achievements { get; init; }
}