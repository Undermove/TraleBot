namespace Infrastructure.Translation.GoogleTranslation;

public record GoogleApiConfig(string ApiKeyBase64)
{
    public const string Name = "GoogleTranslateApiConfiguration";
}