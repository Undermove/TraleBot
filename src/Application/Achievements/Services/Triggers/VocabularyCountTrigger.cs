using Application.Common.Interfaces.Achievements;

namespace Application.Achievements.Services.Triggers;

public class VocabularyCountTrigger: IAchievementTrigger
{
    public required int VocabularyEntriesCount { get; init; }
}