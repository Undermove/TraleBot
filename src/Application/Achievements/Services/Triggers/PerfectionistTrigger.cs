using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Triggers;

public class PerfectionistTrigger : IAchievementTrigger
{
    public required int WordsCount { get; init; }
    public int IncorrectAnswersCount { get; set; }
}