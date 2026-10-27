using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// Mini-app events outside lessons are stored as sent when they are known ones, unknown ones are dropped
/// silently, a field that does not fit is dropped without the event, a batch is capped and so is a person's day.
/// </summary>
public class RecordAppEventsCommandTests : CommandTestsBase
{
    private User _user = null!;
    private RecordAppEvents.Handler _handler = null!;

    [SetUp]
    public async Task SetUp()
    {
        _user = Create.User().Build();
        Context.Users.Add(_user);
        await Context.SaveChangesAsync();
        _handler = new RecordAppEvents.Handler(Context);
    }

    private static AppEventInput Ev(string ev = "screen", string? target = "dashboard", int? value = null,
        string? platform = null, string? startParam = null) => new(ev, target, value, platform, startParam);

    private Task<int> Send(params AppEventInput[] items) =>
        _handler.Handle(new RecordAppEvents { UserId = _user.Id, Items = items }, CancellationToken.None);

    private Task<List<AppEvent>> Stored() =>
        Context.AppEvents.AsNoTracking().Where(e => e.UserId == _user.Id).OrderBy(e => e.CreatedAtUtc).ToListAsync();

    [Test]
    public async Task Known_events_are_stored_in_the_order_sent()
    {
        (await Send(Ev("app_open", null, 3200, "ios", "verbs_site"), Ev("app_ready", null, 4100), Ev(), Ev("app_hide", "verbs", 95))).ShouldBe(4);

        var rows = await Stored();
        rows.Select(r => r.Event).ShouldBe(["app_open", "app_ready", "screen", "app_hide"]);
        rows[0].ShouldSatisfyAllConditions(
            r => r.Value.ShouldBe(3200),
            r => r.Platform.ShouldBe("ios"),
            r => r.StartParam.ShouldBe("verbs_site"));
        rows[3].Target.ShouldBe("verbs");
    }

    [Test]
    public async Task Unknown_events_and_out_of_range_values_are_dropped_silently()
    {
        var stored = await Send(
            Ev("clicked"), Ev(target: "Robert'); DROP TABLE"), Ev(value: -5), Ev(value: 20_000_000),
            new AppEventInput(null, null, null, null, null), Ev("paywall", "module"));

        stored.ShouldBe(1);
        (await Stored()).Single().Event.ShouldBe("paywall");
    }

    [Test]
    public async Task An_odd_platform_or_start_parameter_is_dropped_but_the_event_is_kept()
    {
        (await Send(Ev("app_open", null, 100, "iOS 18; <script>", "two words"))).ShouldBe(1);

        var row = (await Stored()).Single();
        row.Platform.ShouldBeNull();
        row.StartParam.ShouldBeNull();
    }

    [Test]
    public async Task A_batch_keeps_at_most_fifty_events()
    {
        (await Send(Enumerable.Range(0, 80).Select(_ => Ev()).ToArray())).ShouldBe(RecordAppEvents.MaxBatch);
    }

    [Test]
    public async Task Past_the_daily_cap_nothing_more_is_stored()
    {
        Context.AppEvents.AddRange(Enumerable.Range(0, RecordAppEvents.MaxPerUserPerDay - 2).Select(_ => new AppEvent
        {
            Id = Guid.NewGuid(), UserId = _user.Id, Event = "screen", Target = "dashboard", CreatedAtUtc = DateTime.UtcNow
        }));
        Context.AppEvents.Add(new AppEvent
        {
            Id = Guid.NewGuid(), UserId = _user.Id, Event = "screen", Target = "dashboard", CreatedAtUtc = DateTime.UtcNow.AddDays(-2)
        });
        await Context.SaveChangesAsync();

        (await Send(Ev(), Ev(), Ev(), Ev())).ShouldBe(2);
        (await Send(Ev())).ShouldBe(0);
    }
}
