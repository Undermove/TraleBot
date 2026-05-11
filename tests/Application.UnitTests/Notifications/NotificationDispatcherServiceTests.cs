using Application.Admin;
using Application.Notifications;
using Application.UnitTests.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests.Notifications;

[TestFixture]
public class NotificationDispatcherServiceTests : CommandTestsBase
{
    private static readonly TimeZoneInfo TbilisiTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tbilisi");

    // Jan 7 in Tbilisi = Jan 6 20:00 UTC (UTC+4)
    private static readonly DateTimeOffset HolidayUtcOffset =
        new(2026, 1, 6, 20, 0, 0, TimeSpan.Zero);

    // Ordinary day: May 12 10:00 UTC = May 12 14:00 Tbilisi (no holiday)
    private static readonly DateTimeOffset OrdinaryUtcOffset =
        new(2026, 5, 12, 10, 0, 0, TimeSpan.Zero);

    private Mock<ITelegramMessageSender> _senderMock = null!;
    private HolidayCalendarService _holidayService = null!;

    [SetUp]
    public void SetUpDispatcher()
    {
        _senderMock = new Mock<ITelegramMessageSender>();
        _senderMock
            .Setup(s => s.SendTextAsync(
                It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _holidayService = new HolidayCalendarService();
    }

    private NotificationDispatcherService CreateSut(DateTimeOffset now)
    {
        var tp = new FixedTimeProvider(now);
        return new NotificationDispatcherService(Context, _holidayService, _senderMock.Object, tp);
    }

    private async Task<User> SeedUserAsync(bool notificationsEnabled = true)
    {
        var userId = Guid.NewGuid();
        var settingsId = Guid.NewGuid();
        var user = new User
        {
            Id = userId,
            TelegramId = Random.Shared.NextInt64(100_000, 999_999),
            AccountType = UserAccountType.Free,
            InitialLanguageSet = true,
            IsActive = true,
            NotificationsEnabled = notificationsEnabled,
            UserSettingsId = settingsId,
            Settings = new UserSettings
            {
                Id = settingsId,
                UserId = userId,
                CurrentLanguage = Language.Russian
            }
        };
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    private async Task<MiniAppUserProgress> SeedProgressAsync(
        Guid userId, int xp = 0, int xpSpent = 0,
        int streak = 0, DateTime? lastFedAtUtc = null)
    {
        var p = new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Xp = xp,
            XpSpent = xpSpent,
            Streak = streak,
            LastFedAtUtc = lastFedAtUtc,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        Context.MiniAppUserProgresses.Add(p);
        await Context.SaveChangesAsync();
        return p;
    }

    private async Task<NotificationTrigger> SeedTriggerAsync(
        Guid userId, NotificationSource source,
        DateTime? lastSentAt = null, int nextMilestone = 7)
    {
        var t = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Source = source,
            LastSentAt = lastSentAt,
            NextStreakMilestone = nextMilestone
        };
        Context.NotificationTriggers.Add(t);
        await Context.SaveChangesAsync();
        return t;
    }

    // ── Holiday trigger ──────────────────────────────────────────────────────

    [Test]
    public async Task HolidayTrigger_WhenAlreadySentToday_DoesNotSendAgain()
    {
        var user = await SeedUserAsync();
        // Jan 7 00:00 UTC → Jan 7 04:00 Tbilisi — same day as HolidayUtcOffset
        await SeedTriggerAsync(user.Id, NotificationSource.Holiday,
            lastSentAt: new DateTime(2026, 1, 7, 0, 0, 0, DateTimeKind.Utc));

        var sut = CreateSut(HolidayUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task HolidayTrigger_WhenNotSentToday_SendsAndUpdatesLastSentAt()
    {
        var user = await SeedUserAsync();
        // No existing holiday trigger

        var sut = CreateSut(HolidayUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(user.TelegramId, It.IsAny<string>(),
                true, It.IsAny<CancellationToken>()),
            Times.Once);

        var trigger = await Context.NotificationTriggers
            .FirstOrDefaultAsync(t => t.UserId == user.Id && t.Source == NotificationSource.Holiday);
        trigger.ShouldNotBeNull();
        trigger!.LastSentAt.ShouldNotBeNull();
    }

    // ── Coins trigger ────────────────────────────────────────────────────────

    [Test]
    public async Task CoinsTrigger_WhenCooldownNotExpired_DoesNotSend()
    {
        var user = await SeedUserAsync();
        await SeedProgressAsync(user.Id, xp: 100, xpSpent: 40); // available = 60 ≥ 50
        // Coins trigger sent 3 days before the test's reference time
        var threeDAgo = OrdinaryUtcOffset.AddDays(-3).UtcDateTime;
        await SeedTriggerAsync(user.Id, NotificationSource.Coins, lastSentAt: threeDAgo);

        var sut = CreateSut(OrdinaryUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task CoinsTrigger_WhenXpThresholdMet_SendsMessageWithCorrectGeorgianText()
    {
        var user = await SeedUserAsync();
        await SeedProgressAsync(user.Id, xp: 100, xpSpent: 30); // available = 70 ≥ 50, never fed

        var sut = CreateSut(OrdinaryUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(
                user.TelegramId,
                It.Is<string>(msg => msg.Contains("ბომბორა გახარდება!")),
                true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ── Streak trigger ───────────────────────────────────────────────────────

    [Test]
    public async Task StreakTrigger_OnDay7_SendsAndUpdatesNextMilestoneTo30()
    {
        var user = await SeedUserAsync();
        await SeedProgressAsync(user.Id, streak: 7);
        var trigger = await SeedTriggerAsync(user.Id, NotificationSource.Streak, nextMilestone: 7);

        var sut = CreateSut(OrdinaryUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(user.TelegramId, It.IsAny<string>(),
                true, It.IsAny<CancellationToken>()),
            Times.Once);

        await Context.Entry(trigger).ReloadAsync();
        trigger.NextStreakMilestone.ShouldBe(30);
    }

    [Test]
    public async Task StreakTrigger_OnDay30_MessageContainsTbilisiFormattedNumber()
    {
        var user = await SeedUserAsync();
        await SeedProgressAsync(user.Id, streak: 30);
        await SeedTriggerAsync(user.Id, NotificationSource.Streak, nextMilestone: 30);

        var sut = CreateSut(OrdinaryUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(
                user.TelegramId,
                It.Is<string>(msg => msg.Contains("ოცდაათი (20+10) დღე")),
                true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ── Notifications disabled ───────────────────────────────────────────────

    [Test]
    public async Task Dispatcher_WhenNotificationsDisabled_SendsZeroMessages()
    {
        await SeedUserAsync(notificationsEnabled: false);

        var sut = CreateSut(HolidayUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ── Ordinary day — no triggers fire ──────────────────────────────────────

    [Test]
    public async Task Dispatcher_OrdinaryDay_NoHolidayNoCoinsNoStreak_SendsNothing()
    {
        var user = await SeedUserAsync();
        // XP too low (10), streak not at any milestone (5)
        await SeedProgressAsync(user.Id, xp: 10, xpSpent: 0, streak: 5);

        var sut = CreateSut(OrdinaryUtcOffset);
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ── At most one message per user per run ────────────────────────────────

    [Test]
    public async Task Dispatcher_MultipleTriggersForOneUser_SendsOnlyOneTelegramMessage()
    {
        var user = await SeedUserAsync();
        // Holiday (Jan 7) + high XP + streak at day 7 — all would fire
        await SeedProgressAsync(user.Id, xp: 100, xpSpent: 0, streak: 7);
        await SeedTriggerAsync(user.Id, NotificationSource.Streak, nextMilestone: 7);

        var sut = CreateSut(HolidayUtcOffset); // Jan 7 = Georgian Christmas
        await sut.ExecuteAsync(CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(user.TelegramId, It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
