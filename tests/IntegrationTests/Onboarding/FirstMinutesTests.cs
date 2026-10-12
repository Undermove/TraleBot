using Application.Common;
using Application.Notifications;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.CommonComponents;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot;
using Telegram.Bot.Requests;
using Telegram.Bot.Types.ReplyMarkups;

namespace IntegrationTests.Onboarding;

/// <summary>
/// The first minutes of a newcomer in the bot, against real Postgres and with the mini-app switched
/// on: what /start answers (plain, with a source tag, by a friend's link, to someone who is already
/// here) and who gets the one reminder to open the mini-app.
/// </summary>
public class FirstMinutesTests : TestBase
{
    private TraleTestApplication _app = null!;
    private TelegramClientFake _telegram = null!;

    /// <summary>The moment the reminder was switched on in this database: 30 hours ago.</summary>
    private static readonly DateTime Now = DateTime.UtcNow;
    private static readonly DateTime SwitchedOnAt = Now.AddHours(-30);

    [OneTimeSetUp]
    public async Task StartAppWithMiniApp()
    {
        _app = _testServer.WithSignedLogin(ownerTelegramId: 1);
        _telegram = (TelegramClientFake)_app.Services.GetRequiredService<ITelegramBotClient>();
        // The first run after the release only remembers when it happened.
        await Remind(SwitchedOnAt);
    }

    [OneTimeTearDown]
    public async Task StopApp() => await _app.DisposeAsync();

    // ── /start ──────────────────────────────────────────────────────────────

    [Test]
    public async Task Newcomer_gets_one_message_from_Bombora_with_one_button_that_opens_the_mini_app()
    {
        var telegramId = NewTelegramId();

        await Send(telegramId, "/start");

        var message = MessagesTo(telegramId).Should().ContainSingle().Subject;
        message.Text.Should().Be(
            """
            გამარჯობა, Test! 👋 Это «гамарджоба» — «привет» по-грузински.

            Я Бомбора 🐶, помогу тебе с грузинским. Одна минута — и ты узнаешь первую грузинскую букву: как она выглядит, как звучит и как называется.

            Первые 30 дней — всё бесплатно.
            """);
        var button = Buttons(message).Should().ContainSingle().Subject;
        button.Text.Should().Be("🚀 Узнать первую букву");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/");
        (await UserBy(telegramId)).Should().NotBeNull();
    }

    [TestCase("threads")]
    [TestCase("seo_alphabet")]
    public async Task Newcomer_by_a_tagged_link_gets_the_same_message_and_the_source_is_recorded(string tag)
    {
        var telegramId = NewTelegramId();

        await Send(telegramId, $"/start {tag}");

        var message = MessagesTo(telegramId).Should().ContainSingle().Subject;
        message.Text.Should().Contain(FirstStepMessage.Promise);
        Buttons(message).Should().ContainSingle().Which.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/");
        (await UserBy(telegramId))!.AcquisitionSource.Should().Be(tag);
    }

    [Test]
    public async Task Newcomer_by_a_friends_link_is_told_about_sixty_days_and_the_invitation_is_recorded()
    {
        var friend = await AddUser(registeredAt: Now.AddDays(-200));
        var telegramId = NewTelegramId();

        await Send(telegramId, $"/start ref_{friend.TelegramId}");

        var message = MessagesTo(telegramId).Should().ContainSingle().Subject;
        message.Text.Should().Contain(FirstStepMessage.Promise)
            .And.Contain("60 дней бесплатно вместо 30")
            .And.NotContain(FirstStepMessage.TrialLine);
        Buttons(message).Should().ContainSingle().Which.Text.Should().Be(FirstStepMessage.ButtonLabel);
        var user = (await UserBy(telegramId))!;
        user.TrialDaysLeft().Should().Be(60);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Referrals
            .AnyAsync(r => r.RefereeUserId == user.Id && r.ReferrerUserId == friend.Id))).Should().BeTrue();
    }

    [Test]
    public async Task Newcomer_by_the_verbs_link_gets_a_button_to_the_verbs_section_and_no_promise_of_a_letter()
    {
        var telegramId = NewTelegramId();

        await Send(telegramId, "/start verbs_oct");

        var message = MessagesTo(telegramId).Should().ContainSingle().Subject;
        message.Text.Should().Contain("Я Бомбора").And.Contain("«Глаголы»").And.NotContain("букву");
        var button = Buttons(message).Should().ContainSingle().Subject;
        button.Text.Should().Be(FirstStepMessage.VerbsButtonLabel);
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?screen=verbs&src=verbs_oct");
    }

    [Test]
    public async Task Someone_who_is_already_here_gets_the_welcome_back_message_and_keeps_the_first_source()
    {
        var telegramId = NewTelegramId();
        await Send(telegramId, "/start threads");
        var before = MessagesTo(telegramId).Count;

        await Send(telegramId, "/start seo_alphabet");

        var message = MessagesTo(telegramId).Skip(before).Should().ContainSingle().Subject;
        message.Text.Should().StartWith("გამარჯობა снова, Test!").And.NotContain(FirstStepMessage.Promise);
        Buttons(message).Where(b => b.WebApp != null).Should().ContainSingle()
            .Which.Text.Should().Be("🚀 Открыть приложение");
        (await UserBy(telegramId))!.AcquisitionSource.Should().Be("threads");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.CountAsync(u => u.TelegramId == telegramId)))
            .Should().Be(1);
    }

    [Test]
    public async Task Someone_who_blocked_the_bot_and_came_back_is_not_greeted_as_a_newcomer()
    {
        var user = await AddUser(registeredAt: Now.AddDays(-90), isActive: false);

        await Send(user.TelegramId, "/start");

        var message = MessagesTo(user.TelegramId).Should().ContainSingle().Subject;
        message.Text.Should().StartWith("გამარჯობა снова").And.NotContain(FirstStepMessage.Promise)
            .And.NotContain(FirstStepMessage.TrialLine);
        (await UserBy(user.TelegramId))!.IsActive.Should().BeTrue();
    }

    // ── the reminder ────────────────────────────────────────────────────────

    [Test]
    public async Task Newcomer_who_did_not_open_the_mini_app_is_reminded_once_a_day_later()
    {
        var user = await AddUser(registeredAt: Now.AddHours(-25));

        await Remind(Now);
        await Remind(Now);
        await Remind(Now.AddHours(1));
        await Remind(Now.AddDays(8));

        var message = MessagesTo(user.TelegramId).Should().ContainSingle().Subject;
        message.Text.Should().Be("Это Бомбора 🐶 Первая грузинская буква всё ещё ждёт тебя — это одна минута. Заглянешь?");
        var button = Buttons(message).Should().ContainSingle().Subject;
        button.Text.Should().Be("🚀 Узнать первую букву");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/");
    }

    [Test]
    public async Task Reminder_waits_for_a_day_to_pass()
    {
        var user = await AddUser(registeredAt: Now.AddHours(-2));

        await Remind(Now);
        MessagesTo(user.TelegramId).Should().BeEmpty();

        await Remind(Now.AddHours(22));
        MessagesTo(user.TelegramId).Should().ContainSingle();
    }

    [Test]
    public async Task Whoever_opened_the_mini_app_is_not_reminded()
    {
        var user = await AddUser(registeredAt: Now.AddHours(-25));
        using (var client = _app.ClientFor(user.TelegramId))
        {
            (await client.GetAsync("/api/miniapp/me")).IsSuccessStatusCode.Should().BeTrue();
        }

        await Remind(Now);

        MessagesTo(user.TelegramId).Should().BeEmpty();
    }

    [Test]
    public async Task Whoever_blocked_the_bot_or_switched_notifications_off_is_not_reminded()
    {
        var blocked = await AddUser(registeredAt: Now.AddHours(-25), isActive: false);
        var optedOut = await AddUser(registeredAt: Now.AddHours(-25), notificationsEnabled: false);

        await Remind(Now);

        MessagesTo(blocked.TelegramId).Should().BeEmpty();
        MessagesTo(optedOut.TelegramId).Should().BeEmpty();
    }

    [Test]
    public async Task Whoever_registered_before_the_reminder_was_switched_on_is_never_reminded()
    {
        // Registered 10 hours before the switch-on: a day has passed, the mini-app was never opened —
        // and still nothing, the old base is left alone.
        var before = await AddUser(registeredAt: SwitchedOnAt.AddHours(-10));
        var longAgo = await AddUser(registeredAt: Now.AddDays(-120));

        await Remind(Now);
        await Remind(Now.AddDays(1));

        MessagesTo(before.TelegramId).Should().BeEmpty();
        MessagesTo(longAgo.TelegramId).Should().BeEmpty();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static long NewTelegramId() => Random.Shared.NextInt64(1_000_000, 900_000_000_000);

    private async Task Send(long telegramId, string text)
    {
        using var client = _app.CreateClient();
        var response = await client.PostAsync("/telegram/test_token",
            Create.TelegramUpdate(Random.Shared.Next(1, int.MaxValue), telegramId, text).ToJsonContent());
        response.IsSuccessStatusCode.Should().BeTrue();
    }

    private Task<int> Remind(DateTime nowUtc) => InScope(async sp =>
    {
        await sp.GetRequiredService<FirstOpenReminderService>().DispatchAsync(nowUtc, CancellationToken.None);
        return 0;
    });

    private List<SendMessageRequest> MessagesTo(long telegramId) =>
        _telegram.Requests.OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == telegramId).ToList();

    private static List<InlineKeyboardButton> Buttons(SendMessageRequest message) =>
        ((InlineKeyboardMarkup)message.ReplyMarkup!).InlineKeyboard.SelectMany(row => row).ToList();

    private Task<User?> UserBy(long telegramId) => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleOrDefaultAsync(u => u.TelegramId == telegramId));

    private Task<User> AddUser(DateTime registeredAt, bool isActive = true, bool notificationsEnabled = true) =>
        InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = Create.User(NewTelegramId(), "Test");
            user.RegisteredAtUtc = registeredAt;
            user.IsActive = isActive;
            user.NotificationsEnabled = notificationsEnabled;
            db.Users.Add(user);
            await db.SaveChangesAsync(CancellationToken.None);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return user;
        });

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }
}
