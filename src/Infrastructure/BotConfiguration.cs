namespace Infrastructure;

public class BotConfiguration
{
    public const string Configuration = "BotConfiguration"; 
    public required string Token { get; init; }
    public required string HostAddress { get; init; }
    public required string WebhookToken { get; init; }
    public required string PaymentProviderToken { get; init; }
}