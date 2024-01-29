namespace Infrastructure.Translation.OpenAiTranslation;

public class OpenAiConfig
{
	public const string Name = "OpenAiConfiguration"; 
	public required string ApiKey { get; init; }
}