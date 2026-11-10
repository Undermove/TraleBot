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
/// Right after the first finished lesson the bot asks, once, to pin the chat — so people do not lose it.
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

    private List<SendMessageRequest> SentTo(User user) =>
        _telegram.Requests.OfType<SendMessageRequest>().Where(m => m.ChatId.Identifier == user.TelegramId).ToList();

    [Test]
    public async Task The_first_finished_lesson_brings_the_tip_to_pin_the_chat_and_later_lessons_do_not()
    {
        var user = await NewUser();

        await Finish(user, 1);

        var tip = SentTo(user).Should().ContainSingle().Subject;
        tip.Text.Should().Be(PinChatTip.Text);
        tip.Text.Should().StartWith("Первый урок пройден 👏 Закрепи этот чат");
        tip.Text.Should().Contain("iPhone").And.Contain("Android").And.Contain("Компьютер");
        tip.ReplyMarkup.Should().BeNull();

        await Finish(user, 12);
        await Finish(user, 1);

        SentTo(user).Should().ContainSingle("the tip comes once");
    }

    [Test]
    public async Task A_lesson_that_did_not_count_brings_nothing_and_the_tip_comes_with_the_one_that_did()
    {
        var user = await NewUser();

        await Finish(user, 1, correct: 1);
        SentTo(user).Should().BeEmpty();

        await Finish(user, 1);
        SentTo(user).Should().ContainSingle();
    }

    [Test]
    public async Task Whoever_already_has_lessons_or_switched_notifications_off_gets_nothing()
    {
        var old = await NewUser();
        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress
            {
                Id = Guid.NewGuid(), UserId = old.Id, CompletedLessonsJson = """{"alphabet-progressive":[1,12]}""",
                CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }
        var silent = await NewUser(u => u.NotificationsEnabled = false);

        await Finish(old, 2);
        await Finish(silent, 1);

        SentTo(old).Should().BeEmpty();
        SentTo(silent).Should().BeEmpty();
        await using var check = _app.Services.CreateAsyncScope();
        (await check.ServiceProvider.GetRequiredService<ITraleDbContext>().NotificationTriggers
            .AnyAsync(t => t.Source == PinChatTip.Source && (t.UserId == old.TelegramId || t.UserId == silent.TelegramId)))
            .Should().BeFalse();
    }
}
