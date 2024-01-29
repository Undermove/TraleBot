namespace Infrastructure.Translation.GoogleTranslation;

public class GoogleApiConfig
{
    public required string ApiKeyBase64 { get; init; }
    public const string Name = "GoogleTranslateApiConfiguration";
}