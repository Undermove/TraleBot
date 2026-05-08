namespace Infrastructure.Telegram.Services;

public class SentenceBuilderQuestion
{
    public TargetSentenceData TargetSentence { get; set; } = new();
    public int Level { get; set; }
    public List<string> CorrectOrder { get; set; } = new();
    public List<string> ChipPool { get; set; } = new();
    public List<PresetPosition> PresetPositions { get; set; } = new();
    public Dictionary<string, string> Hints { get; set; } = new();
}

public class TargetSentenceData
{
    public string Ru { get; set; } = string.Empty;
}

public class PresetPosition
{
    public int Position { get; set; }
    public string Token { get; set; } = string.Empty;
}
