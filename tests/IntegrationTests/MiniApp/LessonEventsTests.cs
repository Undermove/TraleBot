using System.Net;
using System.Net.Http.Json;
using Application.Common;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Lesson-flow events reach the LessonEvents table over HTTP against real Postgres (the migration applies):
/// a signed-in learner always gets 204, unknown events are dropped, a stranger gets 401.
/// </summary>
public class LessonEventsTests : TestBase
{
    private const long Owner = 4_400_000_777;
    private static long _nextTelegramId = 7_300_000_000;

    private TraleTestApplication _app = null!;
    private long _telegramId;
    private Guid _userId;

    [OneTimeSetUp]
    public void StartSignedApp() => _app = _testServer.WithSignedLogin(Owner);

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CreateLearner()
    {
        _telegramId = Interlocked.Increment(ref _nextTelegramId);
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = Create.User(_telegramId, "Learner");
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        _userId = user.Id;
    }

    private static object Batch(params object[] events) => new { events };

    private static object Ev(int step, string kind, string ev, int? value = null) =>
        new { moduleId = "alphabet-progressive", lessonId = 12, step, stepKind = kind, @event = ev, value };

    [Test]
    public async Task Known_events_are_stored_and_unknown_dropped()
    {
        using var client = _app.ClientFor(_telegramId);
        var resp = await client.PostAsJsonAsync("/api/miniapp/events", Batch(
            Ev(0, "opener", "lesson_open"), Ev(1, "new-word", "step_start"), Ev(1, "new-word", "step_done"),
            Ev(2, "selfie", "step_start"), Ev(3, "cafe", "step_done", 5)));

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await using var scope = _app.Services.CreateAsyncScope();
        var rows = await scope.ServiceProvider.GetRequiredService<ITraleDbContext>().LessonEvents.AsNoTracking()
            .Where(e => e.UserId == _userId).OrderBy(e => e.CreatedAtUtc).ToListAsync();
        rows.Select(r => (r.Step, r.StepKind, r.Event)).Should().Equal(
            (0, "opener", "lesson_open"), (1, "new-word", "step_start"), (1, "new-word", "step_done"), (3, "cafe", "step_done"));
        rows.Last().Value.Should().Be(5);
    }

    [Test]
    public async Task An_empty_or_junk_batch_is_still_204()
    {
        using var client = _app.ClientFor(_telegramId);
        (await client.PostAsJsonAsync("/api/miniapp/events", new { events = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.PostAsJsonAsync("/api/miniapp/events", new { other = 1 })).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Test]
    public async Task A_stranger_is_turned_away()
    {
        using var client = _app.CreateClient();
        (await client.PostAsJsonAsync("/api/miniapp/events", Batch(Ev(0, "opener", "lesson_open")))).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }
}
