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

        // RecordReferralLinkService / RecordAcquisitionSourceService are never called
        // in the returning-user /start flow (only on "ref_" / source-tag args). Safe
        // to pass null.
        return new StartCommand(_mockClient.Object, _mockMediator.Object, botConfig, null!, null!, NullLoggerFactory.Instance);
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

    private static TelegramRequest BuildNewcomerRequest(long telegramId, string text = "/start")
    {
        var update = new TgUpdate
        {
            Id = 1,
            Message = new TgMessage
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new TgChat { Id = telegramId, Type = ChatType.Private, FirstName = "Нино" },
                From = new TgBotUser { Id = telegramId, IsBot = false, FirstName = "Нино" },
                Text = text
            }
        };
        return new TelegramRequest(update, null);
    }

    private void RegistersAsNew(long telegramId) =>
        _mockMediator
            .Setup(m => m.Send(It.IsAny<Application.Users.Commands.CreateUser.CreateUser>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Application.Users.Commands.CreateUser.CreateUserResult.UserCreated(new DomainUser
            {
                Id = Guid.NewGuid(), TelegramId = telegramId, IsActive = true, InitialLanguageSet = true,
                RegisteredAtUtc = DateTime.UtcNow
            }));

    [TestCase("/start")]
    [TestCase("/app")]
    public async Task SendOneShortMessageFromBombora_ToANewcomer(string command)
    {
        RegistersAsNew(555);
        var sut = BuildCommandWithMiniApp(miniAppEnabled: true);

        await sut.Execute(BuildNewcomerRequest(555, command), CancellationToken.None);

        _capturedTexts.Count.ShouldBe(1);
        _capturedTexts[0].ShouldStartWith("გამარჯობა, Нино!");
        _capturedTexts[0].ShouldContain("Я Бомбора");
        _capturedTexts[0].ShouldContain("первую грузинскую букву");
        _capturedTexts[0].Length.ShouldBeLessThan(300);
    }

    [Test]
    public async Task NotPromiseTheMiniApp_ToANewcomer_WhenItIsSwitchedOff()
    {
        RegistersAsNew(556);
        var sut = BuildCommandWithMiniApp(miniAppEnabled: false);

        await sut.Execute(BuildNewcomerRequest(556), CancellationToken.None);

        _capturedTexts.Count.ShouldBe(1);
        _capturedTexts[0].ShouldContain("Напиши мне любое слово");
        _capturedTexts[0].ShouldNotContain("букву");
    }

    [Test]
    public void AddressTheNewcomerWithoutGrammaticalGender()
    {
        // «выучил», «пришёл», «готов» address a man only — the first message is for everyone.
        var texts = new[]
        {
            Infrastructure.Telegram.CommonComponents.FirstStepMessage.WelcomeText("Нино", referralBonus: false),
            Infrastructure.Telegram.CommonComponents.FirstStepMessage.WelcomeText("Нино", referralBonus: true),
            Infrastructure.Telegram.CommonComponents.FirstStepMessage.WelcomeText("Нино", false, verbsSection: true),
            Infrastructure.Telegram.CommonComponents.FirstStepMessage.ReminderText,
        };
        foreach (var text in texts)
        {
            System.Text.RegularExpressions.Regex.IsMatch(text, @"\b(выучил|узнал|пришёл|пришел|готов|рад|должен|сам)\b")
                .ShouldBeFalse(text);
            text.ShouldNotContain("мини-аб");
        }
    }
}
