using System.Net;
using System.Net.Http.Json;
using Application.Common;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Mini-app events outside lessons reach the AppEvents table over HTTP against real Postgres (the migration
/// applies): a signed-in person always gets 204, unknown events are dropped, a stranger gets 401.
/// </summary>
public class AppEventsTests : TestBase
{
    private const long Owner = 4_400_000_778;
    private static long _nextTelegramId = 7_400_000_000;

    private TraleTestApplication _app = null!;
    private long _telegramId;
    private Guid _userId;

    [OneTimeSetUp]
    public void StartSignedApp() => _app = _testServer.WithSignedLogin(Owner);

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CreatePerson()
    {
        _telegramId = Interlocked.Increment(ref _nextTelegramId);
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = Create.User(_telegramId, "Newcomer");
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        _userId = user.Id;
    }

    [Test]
    public async Task Known_events_are_stored_and_unknown_dropped()
    {
        using var client = _app.ClientFor(_telegramId);
        var resp = await client.PostAsJsonAsync("/api/miniapp/app-events", new
        {
            events = new object[]
            {
                new { @event = "app_open", value = 3200, platform = "android", startParam = "verbs_site" },
                new { @event = "app_ready", value = 4100 },
                new { @event = "screen", target = "onboarding" },
                new { @event = "selfie", target = "onboarding" },
                new { @event = "app_hide", target = "onboarding", value = 40 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await using var scope = _app.Services.CreateAsyncScope();
        var rows = await scope.ServiceProvider.GetRequiredService<ITraleDbContext>().AppEvents.AsNoTracking()
            .Where(e => e.UserId == _userId).OrderBy(e => e.CreatedAtUtc).ToListAsync();
        rows.Select(r => (r.Event, r.Target)).Should().Equal(
            ("app_open", null), ("app_ready", null), ("screen", "onboarding"), ("app_hide", "onboarding"));
        rows[0].Platform.Should().Be("android");
        rows[0].StartParam.Should().Be("verbs_site");
    }

    [Test]
    public async Task An_empty_or_junk_batch_is_still_204()
    {
        using var client = _app.ClientFor(_telegramId);
        (await client.PostAsJsonAsync("/api/miniapp/app-events", new { events = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.PostAsJsonAsync("/api/miniapp/app-events", new { other = 1 })).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Test]
    public async Task A_stranger_is_turned_away()
    {
        using var client = _app.CreateClient();
        (await client.PostAsJsonAsync("/api/miniapp/app-events", new { events = new[] { new { @event = "app_open" } } })).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }
}
