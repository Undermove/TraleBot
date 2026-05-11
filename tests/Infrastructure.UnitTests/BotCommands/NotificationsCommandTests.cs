using Application.Common;
using Application.MiniApp.Services;
using Domain.Entities;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;
using TgMessage = Telegram.Bot.Types.Message;
using TgUpdate = Telegram.Bot.Types.Update;
using TgChat = Telegram.Bot.Types.Chat;
using TgBotUser = Telegram.Bot.Types.User;

namespace Infrastructure.UnitTests.BotCommands;

[TestFixture]
public class NotificationsCommandTests
{
    private Mock<ITelegramBotClient> _mockClient = null!;
    private Mock<UpdateNotificationsSettingsService> _mockService = null!;
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

        // Pass a mock ITraleDbContext so Castle DynamicProxy can satisfy the constructor.
        var mockDb = new Mock<ITraleDbContext>();
        _mockService = new Mock<UpdateNotificationsSettingsService>(mockDb.Object);
        _mockService
            .Setup(s => s.ExecuteAsync(It.IsAny<Guid>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(UpdateNotificationsSettingsResult.Success);
    }

    private NotificationsCommand BuildCommand() =>
        new(_mockClient.Object, _mockService.Object);

    private static TelegramRequest BuildRequest(string text, bool notificationsEnabled = true)
    {
        var userId = Guid.NewGuid();
        var settingsId = Guid.NewGuid();
        var user = new Domain.Entities.User
        {
            Id = userId,
            TelegramId = 99999,
            IsActive = true,
            AccountType = UserAccountType.Free,
            RegisteredAtUtc = DateTime.UtcNow,
            InitialLanguageSet = true,
            NotificationsEnabled = notificationsEnabled,
            UserSettingsId = settingsId,
            Settings = new UserSettings
            {
                Id = settingsId,
                UserId = userId,
                CurrentLanguage = Language.Russian
            }
        };

        var update = new TgUpdate
        {
            Id = 1,
            Message = new TgMessage
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new TgChat { Id = 99999, Type = ChatType.Private, FirstName = "TestUser" },
                From = new TgBotUser { Id = 99999, IsBot = false, FirstName = "TestUser" },
                Text = text
            }
        };

        return new TelegramRequest(update, user);
    }

    // ── IsApplicable ─────────────────────────────────────────────────────────

    [Test]
    public async Task IsApplicable_WhenTextStartsWithNotifications_ReturnsTrue()
    {
        var command = BuildCommand();
        var request = BuildRequest("/notifications on");

        var result = await command.IsApplicable(request, CancellationToken.None);

        result.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_WhenTextIsDifferentCommand_ReturnsFalse()
    {
        var command = BuildCommand();
        var request = BuildRequest("/help");

        var result = await command.IsApplicable(request, CancellationToken.None);

        result.ShouldBeFalse();
    }

    // ── Unknown / missing argument ────────────────────────────────────────────

    [Test]
    public async Task NotificationsCommand_UnknownArgument_RepliesUsageHint()
    {
        var command = BuildCommand();
        var request = BuildRequest("/notifications maybe");

        await command.Execute(request, CancellationToken.None);

        _capturedTexts.ShouldContain(t => t.Contains("Используй /notifications on или /notifications off"));
    }

    [Test]
    public async Task NotificationsCommand_NoArgument_RepliesUsageHint()
    {
        var command = BuildCommand();
        var request = BuildRequest("/notifications");

        await command.Execute(request, CancellationToken.None);

        _capturedTexts.ShouldContain(t => t.Contains("Используй /notifications on или /notifications off"));
    }

    // ── Case-insensitive arguments ────────────────────────────────────────────

    [Test]
    public async Task NotificationsCommand_CaseInsensitiveArguments_AreHandled()
    {
        var commandOff = BuildCommand();
        var requestOff = BuildRequest("/notifications OFF");
        await commandOff.Execute(requestOff, CancellationToken.None);
        _capturedTexts.ShouldContain(t => t.Contains("Уведомления отключены"));

        _capturedTexts.Clear();

        var commandOn = BuildCommand();
        var requestOn = BuildRequest("/notifications On");
        await commandOn.Execute(requestOn, CancellationToken.None);
        _capturedTexts.ShouldContain(t => t.Contains("Уведомления включены"));
    }

    // ── Delegates to UpdateNotificationsSettingsService ───────────────────────

    [Test]
    public async Task NotificationsOff_DelegatesToService_WithEnabledFalse()
    {
        var command = BuildCommand();
        var request = BuildRequest("/notifications off", notificationsEnabled: true);

        await command.Execute(request, CancellationToken.None);

        _mockService.Verify(
            s => s.ExecuteAsync(request.User!.Id, false, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task NotificationsOn_DelegatesToService_WithEnabledTrue()
    {
        var command = BuildCommand();
        var request = BuildRequest("/notifications on", notificationsEnabled: false);

        await command.Execute(request, CancellationToken.None);

        _mockService.Verify(
            s => s.ExecuteAsync(request.User!.Id, true, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
