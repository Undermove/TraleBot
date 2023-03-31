using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Triggers;

public class PerfectQuizTrigger : IAchievementTrigger
{
    public required int WordsCount { get; init; }
    public required int IncorrectAnswersCount { get; init; }
}