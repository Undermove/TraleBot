using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Triggers;

public class StartingQuizzerTrigger: IAchievementTrigger
{
    public required int QuizzesCount { get; init; }
}