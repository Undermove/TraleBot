using Domain.Entities;

namespace Domain.AchievementTypes;

public class AdvancedSmallTalker: AchievementTypeBase<VocabularyEntry>
{
    public override Guid Id => Guid.Parse("046331C7-E8B8-4BEA-9537-C5BBD9F44288");
    public override string Icon => "🤪";
    public override string Name => "Базовый разговорник";
    public override string UnlockConditionsDescription => "10 слов в словаре";

    public override bool CheckUnlockConditions(VocabularyEntry checkParam)
    {
        return true;
    }
}