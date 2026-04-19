using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using DomainUser = Domain.Entities.User;
using Language = Domain.Entities.Language;
using UserSettings = Domain.Entities.UserSettings;
using UserAccountType = Domain.Entities.UserAccountType;
using BotConfiguration = Infrastructure.Telegram.BotConfiguration;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;
using TgMessage = Telegram.Bot.Types.Message;
using TgUpdate = Telegram.Bot.Types.Update;
using TgChat = Telegram.Bot.Types.Chat;
using TgBotUser = Telegram.Bot.Types.User;

namespace Infrastructure.UnitTests.BotCommands;

[TestFixture]
public class StartCommandShould
{
    private Mock<ITelegramBotClient> _mockClient = null!;
    private Mock<IMediator> _mockMediator = null!;
    private List<string> _capturedTexts = null!;

    [SetUp]
    public void SetUp()
    {
        _capturedTexts = new List<string>();
        _mockClient = new Mock<ITelegramBotClient>();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .Callback<TgRequest, CancellationToken>((req, _) =>
            {
                var textProp = req.GetType().GetProperty("Text");
                if (textProp?.GetValue(req) is string text && !string.IsNullOrEmpty(text))
                    _capturedTexts.Add(text);
            })
            .ReturnsAsync(new TgMessage { MessageId = 1 });
        _mockMediator = new Mock<IMediator>();
    }

    private StartCommand BuildCommandWithMiniApp(bool miniAppEnabled = true)
    {
        var botConfig = new BotConfiguration
        {
            Token = "test_token",
            HostAddress = "https://test.tralebot.com",
            WebhookToken = "test_webhook",
            PaymentProviderToken = "test_payment",
            BotName = "testbot",
            MiniAppEnabled = miniAppEnabled
        };

        // RecordReferralLinkService is never called in the returning-user /start flow
        // (only triggered when args contain "ref_" prefix). Safe to pass null.
        return new StartCommand(_mockClient.Object, _mockMediator.Object, botConfig, null!, NullLoggerFactory.Instance);
    }

    private static TelegramRequest BuildReturningUserRequest(long telegramId, Language language)
    {
        var user = new DomainUser
        {
            Id = Guid.NewGuid(),
            TelegramId = telegramId,
            IsActive = true,
            AccountType = UserAccountType.Free,
            RegisteredAtUtc = DateTime.UtcNow.AddDays(-7),
            InitialLanguageSet = true,
            Settings = new UserSettings
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                CurrentLanguage = language
            }
        };

        var update = new TgUpdate
        {
            Id = 1,
            Message = new TgMessage
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new TgChat { Id = telegramId, Type = ChatType.Private, FirstName = "TestUser" },
                From = new TgBotUser { Id = telegramId, IsBot = false, FirstName = "TestUser" },
                Text = "/start"
            }
        };

        return new TelegramRequest(update, user);
    }

    [Test]
    public async Task SendGeorgianWelcomeBack_WhenMiniAppEnabledAndReturningGeorgianUser()
    {
        // Arrange
        var command = BuildCommandWithMiniApp(miniAppEnabled: true);
        var request = BuildReturningUserRequest(telegramId: 12345, language: Language.Georgian);

        // Act
        await command.Execute(request, CancellationToken.None);

        // Assert — message should contain Georgian-specific copy
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("კარგი?");
        _capturedTexts[0].ShouldContain("мини-апп");
        _capturedTexts[0].ShouldContain("Бомбора");
    }

    [Test]
    public async Task SendDefaultWelcomeBack_WhenMiniAppEnabledButReturningNonGeorgianUser()
    {
        // Arrange
        var command = BuildCommandWithMiniApp(miniAppEnabled: true);
        var request = BuildReturningUserRequest(telegramId: 12346, language: Language.English);

        // Act
        await command.Execute(request, CancellationToken.None);

        // Assert — message should use the original copy, not the Georgian-specific one
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldNotContain("კარგი?");
        _capturedTexts[0].ShouldContain("переведу");
    }

    [Test]
    public async Task SendDefaultWelcomeBack_WhenMiniAppDisabledAndReturningGeorgianUser()
    {
        // Arrange
        var command = BuildCommandWithMiniApp(miniAppEnabled: false);
        var request = BuildReturningUserRequest(telegramId: 12347, language: Language.Georgian);

        // Act
        await command.Execute(request, CancellationToken.None);

        // Assert — MiniAppEnabled=false → existing behaviour unchanged
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldNotContain("კარგი?");
        _capturedTexts[0].ShouldContain("переведу");
    }
}
