using Application.Common;
using Infrastructure.Telegram.BotCommands;
using Infrastructure.Telegram.Models;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using DomainUser = Domain.Entities.User;
using Language = Domain.Entities.Language;
using UserSettings = Domain.Entities.UserSettings;
using UserAccountType = Domain.Entities.UserAccountType;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;
using TgMessage = Telegram.Bot.Types.Message;
using TgUpdate = Telegram.Bot.Types.Update;
using TgChat = Telegram.Bot.Types.Chat;
using TgBotUser = Telegram.Bot.Types.User;

namespace Infrastructure.UnitTests.BotCommands;

/// <summary>
/// Covers BDD scenarios for <see cref="NotificationsCommand"/> (§82, issue #996):
/// the bot-command shortcut to flip <see cref="DomainUser.NotificationsEnabled"/>.
///
/// AC4 (off): `/notifications off` disables, replies with re-enable hint.
/// Reverse:   `/notifications on` enables, replies with disable hint.
/// Status:    `/notifications` (no arg) reports current state and both toggle hints.
/// </summary>
[TestFixture]
public class NotificationsCommandShould
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
            .Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }

    private NotificationsCommand BuildCommand() =>
        new(_mockClient.Object, _mockDb.Object);

    private static DomainUser BuildUser(long telegramId, bool notificationsEnabled) => new()
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

    private static TelegramRequest BuildRequest(DomainUser user, string text)
    {
        var update = new TgUpdate
        {
            Id = 1,
            Message = new TgMessage
            {
                MessageId = 1,
                Date = DateTime.UtcNow,
                Chat = new TgChat { Id = user.TelegramId, Type = ChatType.Private, FirstName = "TestUser" },
                From = new TgBotUser { Id = user.TelegramId, IsBot = false, FirstName = "TestUser" },
                Text = text
            }
        };
        return new TelegramRequest(update, user);
    }

    [Test]
    public async Task IsApplicable_ReturnsTrue_ForBaseCommand()
    {
        var command = BuildCommand();
        var request = BuildRequest(BuildUser(1, true), "/notifications");

        var applicable = await command.IsApplicable(request, CancellationToken.None);

        applicable.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_ReturnsTrue_ForOffArgument()
    {
        var command = BuildCommand();
        var request = BuildRequest(BuildUser(1, true), "/notifications off");

        var applicable = await command.IsApplicable(request, CancellationToken.None);

        applicable.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_ReturnsTrue_ForOnArgument()
    {
        var command = BuildCommand();
        var request = BuildRequest(BuildUser(1, false), "/notifications on");

        var applicable = await command.IsApplicable(request, CancellationToken.None);

        applicable.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_ReturnsTrue_CaseInsensitive_ForArgument()
    {
        var command = BuildCommand();
        var request = BuildRequest(BuildUser(1, true), "/notifications OFF");

        var applicable = await command.IsApplicable(request, CancellationToken.None);

        applicable.ShouldBeTrue();
    }

    [Test]
    public async Task IsApplicable_ReturnsFalse_ForOtherCommand()
    {
        var command = BuildCommand();
        var request = BuildRequest(BuildUser(1, true), "/help");

        var applicable = await command.IsApplicable(request, CancellationToken.None);

        applicable.ShouldBeFalse();
    }

    // AC4 — off
    [Test]
    public async Task Execute_DisablesNotificationsAndConfirms_WhenOffArgument()
    {
        var user = BuildUser(telegramId: 555, notificationsEnabled: true);
        var command = BuildCommand();
        var request = BuildRequest(user, "/notifications off");

        await command.Execute(request, CancellationToken.None);

        user.NotificationsEnabled.ShouldBeFalse();
        _mockDb.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("отключены");
        _capturedTexts[0].ShouldContain("/notifications on");
    }

    // Reverse — on
    [Test]
    public async Task Execute_EnablesNotificationsAndConfirms_WhenOnArgument()
    {
        var user = BuildUser(telegramId: 556, notificationsEnabled: false);
        var command = BuildCommand();
        var request = BuildRequest(user, "/notifications on");

        await command.Execute(request, CancellationToken.None);

        user.NotificationsEnabled.ShouldBeTrue();
        _mockDb.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("включены");
        _capturedTexts[0].ShouldContain("/notifications off");
    }

    // Status — currently enabled
    [Test]
    public async Task Execute_ReportsCurrentStateAsEnabled_WhenNoArgumentAndNotificationsOn()
    {
        var user = BuildUser(telegramId: 557, notificationsEnabled: true);
        var command = BuildCommand();
        var request = BuildRequest(user, "/notifications");

        await command.Execute(request, CancellationToken.None);

        user.NotificationsEnabled.ShouldBeTrue();
        _mockDb.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("включены");
        _capturedTexts[0].ShouldContain("/notifications off");
        _capturedTexts[0].ShouldContain("/notifications on");
    }

    // Status — currently disabled
    [Test]
    public async Task Execute_ReportsCurrentStateAsDisabled_WhenNoArgumentAndNotificationsOff()
    {
        var user = BuildUser(telegramId: 558, notificationsEnabled: false);
        var command = BuildCommand();
        var request = BuildRequest(user, "/notifications");

        await command.Execute(request, CancellationToken.None);

        user.NotificationsEnabled.ShouldBeFalse();
        _mockDb.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("отключены");
        _capturedTexts[0].ShouldContain("/notifications off");
        _capturedTexts[0].ShouldContain("/notifications on");
    }

    [Test]
    public async Task Execute_TreatsUnknownArgumentAsStatus()
    {
        // "/notifications maybe" — unknown second word should fall through to status, not flip state
        var user = BuildUser(telegramId: 559, notificationsEnabled: true);
        var command = BuildCommand();
        var request = BuildRequest(user, "/notifications maybe");

        await command.Execute(request, CancellationToken.None);

        user.NotificationsEnabled.ShouldBeTrue();
        _mockDb.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _capturedTexts.ShouldNotBeEmpty();
        _capturedTexts[0].ShouldContain("включены");
    }
}
