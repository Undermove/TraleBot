using Domain.Entities;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Requests.Abstractions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace Infrastructure.UnitTests.BotCommands;

[TestFixture]
public class ShareCommandShould
{
    private Mock<ITelegramBotClient> _mockClient = null!;
    private List<string> _capturedTexts = null!;

    [SetUp]
    public void SetUp()
    {
        _capturedTexts = new List<string>();
        _mockClient = new Mock<ITelegramBotClient>();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<IRequest<Message>>(), It.IsAny<CancellationToken>()))
            .Callback<IRequest<Message>, CancellationToken>((req, _) =>
            {
                var textProp = req.GetType().GetProperty("Text");
                if (textProp?.GetValue(req) is string text && !string.IsNullOrEmpty(text))
                    _capturedTexts.Add(text);
            })
            .ReturnsAsync(new Message { MessageId = 1 });
    }

    private ShareCommand BuildCommand(string botName = "trale_bot")
    {
        var botConfig = new BotConfiguration
        {
            Token = "test_token",
            HostAddress = "https://test.tralebot.com",
            WebhookToken = "test_webhook",
            PaymentProviderToken = "test_payment",
            BotName = botName,
            MiniAppEnabled = true
        };
        return new ShareCommand(_mockClient.Object, botConfig);
    }

    private static TelegramRequest BuildShareRequest(long telegramId)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            TelegramId = telegramId,
            IsActive = true,
            AccountType = UserAccountType.Free,
            RegisteredAtUtc = DateTime.UtcNow.AddDays(-1),
            InitialLanguageSet = true,
            Settings = new UserSettings { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), CurrentLanguage = Language.English }
        };

        var update = new Update
        {
            Id = 1,
            Message = new Message
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new Chat { Id = telegramId, Type = ChatType.Private, FirstName = "TestUser" },
                From = new Telegram.Bot.Types.User { Id = telegramId, IsBot = false, FirstName = "TestUser" },
                Text = "/share"
            }
        };
        return new TelegramRequest(update, user);
    }

    [Test]
    public async Task ReplyWithReferralLink_ContainingUserId()
    {
        // Arrange
        var command = BuildCommand(botName: "trale_bot");
        var request = BuildShareRequest(telegramId: 12345);

        // Act
        await command.Execute(request, CancellationToken.None);

        // Assert — message must contain the user's referral link
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("ref_12345");
        _capturedTexts[0].ShouldContain("trale_bot");
    }

    [Test]
    public async Task ReplyMessage_ContainsShareInviteText()
    {
        // Arrange
        var command = BuildCommand();
        var request = BuildShareRequest(telegramId: 99999);

        // Act
        await command.Execute(request, CancellationToken.None);

        // Assert — message should contain the invite copy
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("Поделись Бомборой");
    }

    [Test]
    public async Task IsApplicable_ReturnTrue_ForShareCommand()
    {
        // Arrange
        var command = BuildCommand();
        var request = BuildShareRequest(telegramId: 1);

        // Act
        var result = await command.IsApplicable(request, CancellationToken.None);

        // Assert
        result.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_ReturnFalse_ForOtherCommands()
    {
        // Arrange
        var command = BuildCommand();
        var update = new Update
        {
            Id = 1,
            Message = new Message
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new Chat { Id = 1, Type = ChatType.Private, FirstName = "U" },
                From = new Telegram.Bot.Types.User { Id = 1, IsBot = false, FirstName = "U" },
                Text = "/start"
            }
        };
        var request = new TelegramRequest(update, null);

        // Act
        var result = await command.IsApplicable(request, CancellationToken.None);

        // Assert
        result.ShouldBeFalse();
    }
}
