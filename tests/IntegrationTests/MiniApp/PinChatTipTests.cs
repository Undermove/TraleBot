using System.Net.Http.Json;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot;
using Telegram.Bot.Requests;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Once a person has got into it (the third finished lesson) the bot asks, once, to pin the chat — and says how
/// on the Telegram client they use.
/// </summary>
public class PinChatTipTests : TestBase
{
    private const long Owner = 4_000_000_201;
    private static long _nextTelegramId = 6_200_000_000;

    private TraleTestApplication _app = null!;
    private TelegramClientFake _telegram = null!;

    [OneTimeSetUp]
    public void StartSignedApp()
    {
        _app = _testServer.WithSignedLogin(Owner);
        _telegram = (TelegramClientFake)_app.Services.GetRequiredService<ITelegramBotClient>();
    }

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    private async Task<User> NewUser(Action<User>? configure = null)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "Newcomer");
        configure?.Invoke(user);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    }

    private async Task Finish(User user, int lessonId, int correct = 4, string moduleId = "alphabet-progressive")
    {
        using var client = _app.ClientFor(user.TelegramId);
        (await client.PostAsJsonAsync("/api/miniapp/progress/lesson-complete", new { moduleId, lessonId, correct, total = 4 }))
            .EnsureSuccessStatusCode();
    }

    private async Task Opened(User user, string platform)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        db.AppEvents.Add(new AppEvent { Id = Guid.NewGuid(), UserId = user.Id, Event = "app_open", Platform = platform, CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(CancellationToken.None);
    }

    private List<SendMessageRequest> SentTo(User user) =>
        _telegram.Requests.OfType<SendMessageRequest>().Where(m => m.ChatId.Identifier == user.TelegramId).ToList();

    [Test]
    public async Task The_third_finished_lesson_brings_the_tip_for_the_persons_telegram_and_later_lessons_do_not()
    {
        var user = await NewUser();
        await Opened(user, "ios");

        await Finish(user, 1);
        await Finish(user, 12);
        await Finish(user, 12);
        await Finish(user, 2, correct: 1);
        SentTo(user).Should().BeEmpty("two lessons are finished so far");

        await Finish(user, 2);

        var tip = SentTo(user).Should().ContainSingle().Subject;
        tip.Text.Should().Be("""
            Уроков пройдено: 3 👏 Чтобы не искать Бомбору среди других чатов, закрепи этот чат 📌

            Он всегда будет наверху списка, и следующий урок откроется в одно касание.

            Как закрепить на iPhone: в списке чатов смахни этот чат вправо и нажми «Закрепить».
            """);
        tip.ReplyMarkup.Should().BeNull();

        await Finish(user, 13);
        await Finish(user, 1, moduleId: "numbers");

        SentTo(user).Should().ContainSingle("the tip comes once");
    }

    [Test]
    public async Task Whoever_already_has_lessons_gets_the_tip_with_the_next_new_one()
    {
        var old = await NewUser();
        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress
            {
                Id = Guid.NewGuid(), UserId = old.Id, CompletedLessonsJson = """{"alphabet-progressive":[1,12,2,13],"onboarding":[1]}""",
                CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }
        await Opened(old, "ios");
        await Opened(old, "android");

        await Finish(old, 1);
        SentTo(old).Should().BeEmpty("a lesson taken again is not a new one");

        await Finish(old, 3);

        var tip = SentTo(old).Should().ContainSingle().Subject;
        tip.Text.Should().StartWith("Уроков пройдено: 5 👏");
        tip.Text.Should().EndWith("Как закрепить на Android: в списке чатов зажми этот чат и нажми на булавку сверху.");
    }

    [Test]
    public void The_way_to_pin_follows_the_telegram_client_and_all_three_are_listed_when_it_is_unknown()
    {
        PinChatTip.Text(3, "tdesktop").Should().EndWith("Как закрепить: нажми на этот чат правой кнопкой и выбери «Закрепить».");
        PinChatTip.Text(3, "macos").Should().Contain("правой кнопкой").And.NotContain("iPhone");
        PinChatTip.Text(3, null).Should().Contain("• iPhone:").And.Contain("• Android:").And.Contain("• Компьютер:");
        PinChatTip.Text(3, "something-new").Should().Contain("• iPhone:");
    }

    [Test]
    public async Task Whoever_switched_notifications_off_gets_nothing()
    {
        var silent = await NewUser(u => u.NotificationsEnabled = false);

        await Finish(silent, 1);
        await Finish(silent, 12);
        await Finish(silent, 2);

        SentTo(silent).Should().BeEmpty();
        await using var check = _app.Services.CreateAsyncScope();
        (await check.ServiceProvider.GetRequiredService<ITraleDbContext>().NotificationTriggers
            .AnyAsync(t => t.Source == PinChatTip.Source && t.UserId == silent.TelegramId))
            .Should().BeFalse();
    }
}
