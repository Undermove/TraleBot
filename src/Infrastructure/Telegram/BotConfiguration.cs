namespace Infrastructure.Telegram;

public class BotConfiguration
{
    public const string Configuration = "BotConfiguration";
    public required string BotName { get; init; }
    public required string Token { get; init; }
    public required string HostAddress { get; init; }
    public required string WebhookToken { get; init; }
    public required string PaymentProviderToken { get; init; }

    /// <summary>
    /// Feature flag: when true, the bot sets a chat menu button that opens the Kutya mini-app.
    /// When false, the mini-app is still served at the host root and the landing page is visible,
    /// but Telegram users don't get the menu button — i.e. the feature is hidden from prod users.
    /// </summary>
    public bool MiniAppEnabled { get; init; }
}