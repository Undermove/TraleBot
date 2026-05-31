using Application.Common;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using DomainUser = Domain.Entities.User;
using UserSettings = Domain.Entities.UserSettings;
using UserAccountType = Domain.Entities.UserAccountType;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;
using TgMessage = Telegram.Bot.Types.Message;
using TgUpdate = Telegram.Bot.Types.Update;
using TgChat = Telegram.Bot.Types.Chat;
using TgBotUser = Telegram.Bot.Types.User;
using Language = Domain.Entities.Language;

namespace Infrastructure.UnitTests.BotCommands;

[TestFixture]
public class NotificationsCommandTests
{
    private Mock<ITelegramBotClient> _mockClient = null!;
    private Mock<ITraleDbContext> _mockDb = null!;
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

        _mockDb = new Mock<ITraleDbContext>();
        _mockDb
            .Setup(db => db.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }

    private NotificationsCommand BuildCommand() =>
        new(_mockClient.Object, _mockDb.Object, NullLoggerFactory.Instance);

    private static TelegramRequest BuildRequest(long telegramId, string text, bool notificationsEnabled = true)
    {
        var user = new DomainUser
        {
            Id = Guid.NewGuid(),
            TelegramId = telegramId,
            IsActive = true,
            AccountType = UserAccountType.Free,
            RegisteredAtUtc = DateTime.UtcNow.AddDays(-7),
            InitialLanguageSet = true,
            NotificationsEnabled = notificationsEnabled,
            Settings = new UserSettings
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                CurrentLanguage = Language.Georgian
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
                Text = text
            }
        };

        return new TelegramRequest(update, user);
    }

    [Test]
    public async Task NotificationsCommand_Off_SetsEnabledFalseAndReplies()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/notifications off", notificationsEnabled: true);

        await command.Execute(request, CancellationToken.None);

        request.User!.NotificationsEnabled.ShouldBe(false);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("Уведомления отключены");
        _mockDb.Verify(db => db.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task NotificationsCommand_On_SetsEnabledTrueAndReplies()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/notifications on", notificationsEnabled: false);

        await command.Execute(request, CancellationToken.None);

        request.User!.NotificationsEnabled.ShouldBe(true);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("Уведомления включены");
        _mockDb.Verify(db => db.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task NotificationsCommand_UnknownArg_RepliesUsageHint()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/notifications maybe");

        await command.Execute(request, CancellationToken.None);

        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("/notifications on");
        _capturedTexts[0].ShouldContain("/notifications off");
        _mockDb.Verify(db => db.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task NotificationsCommand_Off_WhenAlreadyDisabled_IsIdempotent()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/notifications off", notificationsEnabled: false);

        Should.NotThrow(() => command.Execute(request, CancellationToken.None).GetAwaiter().GetResult());

        request.User!.NotificationsEnabled.ShouldBe(false);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("Уведомления отключены");
        _mockDb.Verify(db => db.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task NotificationsCommand_IsApplicable_ReturnsTrueForNotificationsCommand()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/notifications off");

        var result = await command.IsApplicable(request, CancellationToken.None);

        result.ShouldBe(true);
    }

    [Test]
    public async Task NotificationsCommand_IsApplicable_ReturnsFalseForOtherCommands()
    {
        var command = BuildCommand();
        var request = BuildRequest(telegramId: 12345, text: "/help");

        var result = await command.IsApplicable(request, CancellationToken.None);

        result.ShouldBe(false);
    }
}
