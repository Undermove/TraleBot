using System.Text.Json.Serialization;

namespace Infrastructure.Telegram.Services;

public class SentenceBuilderQuestion
{
    public TargetSentenceData TargetSentence { get; set; } = new(string.Empty);
    public int Level { get; set; }
    public List<string> CorrectOrder { get; set; } = new();
    public List<string> ChipPool { get; set; } = new();
    public List<PresetPosition> PresetPositions { get; set; } = new();
    public Dictionary<string, string> Hints { get; set; } = new();
    [JsonPropertyName("alternativeAnswers")]
    public List<List<string>>? AlternativeAnswers { get; set; }
}

public record TargetSentenceData(string Ru);

public record PresetPosition(int Position, string Token);
