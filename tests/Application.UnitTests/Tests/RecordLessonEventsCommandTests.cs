using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// Lesson-flow events are stored as sent when they are known ones, unknown ones are dropped silently,
/// a batch is capped and so is a learner's day.
/// </summary>
public class RecordLessonEventsCommandTests : CommandTestsBase
{
    private User _user = null!;
    private RecordLessonEvents.Handler _handler = null!;

    [SetUp]
    public async Task SetUp()
    {
        _user = Create.User().Build();
        Context.Users.Add(_user);
        await Context.SaveChangesAsync();
        _handler = new RecordLessonEvents.Handler(Context);
    }

    private static LessonEventInput Ev(string kind = "catch", string ev = "step_start", int step = 2, int? value = null,
        string module = "alphabet-progressive", int lesson = 3) => new(module, lesson, step, kind, ev, value);

    private Task<int> Send(params LessonEventInput[] items) =>
        _handler.Handle(new RecordLessonEvents { UserId = _user.Id, Items = items }, CancellationToken.None);

    private Task<List<LessonEvent>> Stored() =>
        Context.LessonEvents.AsNoTracking().Where(e => e.UserId == _user.Id).OrderBy(e => e.CreatedAtUtc).ToListAsync();

    [Test]
    public async Task Known_events_are_stored_in_the_order_sent()
    {
        (await Send(Ev("opener", "lesson_open", 0), Ev(), Ev(ev: "step_done", value: 7))).ShouldBe(3);

        var rows = await Stored();
        rows.Select(r => r.Event).ShouldBe(["lesson_open", "step_start", "step_done"]);
        rows[2].ShouldSatisfyAllConditions(
            r => r.ModuleId.ShouldBe("alphabet-progressive"),
            r => r.LessonId.ShouldBe(3),
            r => r.Step.ShouldBe(2),
            r => r.StepKind.ShouldBe("catch"),
            r => r.Value.ShouldBe(7));
    }

    [Test]
    public async Task Unknown_kinds_and_out_of_range_values_are_dropped_silently()
    {
        var stored = await Send(
            Ev(kind: "selfie"), Ev(ev: "clicked"), Ev(step: -1), Ev(lesson: 0), Ev(value: -5),
            Ev(module: "Robert'); DROP TABLE"), new LessonEventInput(null, 1, 0, null, null, null),
            Ev("finale", "lesson_complete", 9));

        stored.ShouldBe(1);
        (await Stored()).Single().Event.ShouldBe("lesson_complete");
    }

    [Test]
    public async Task A_batch_keeps_at_most_fifty_events()
    {
        (await Send(Enumerable.Range(0, 80).Select(_ => Ev()).ToArray())).ShouldBe(RecordLessonEvents.MaxBatch);
    }

    [Test]
    public async Task Past_the_daily_cap_nothing_more_is_stored()
    {
        var yesterday = DateTime.UtcNow.AddDays(-2);
        Context.LessonEvents.AddRange(Enumerable.Range(0, RecordLessonEvents.MaxPerUserPerDay - 2).Select(_ => new LessonEvent
        {
            Id = Guid.NewGuid(), UserId = _user.Id, ModuleId = "alphabet-progressive", LessonId = 1, Step = 0,
            StepKind = "opener", Event = "lesson_open", CreatedAtUtc = DateTime.UtcNow
        }));
        Context.LessonEvents.Add(new LessonEvent
        {
            Id = Guid.NewGuid(), UserId = _user.Id, ModuleId = "alphabet-progressive", LessonId = 1, Step = 0,
            StepKind = "opener", Event = "lesson_open", CreatedAtUtc = yesterday
        });
        await Context.SaveChangesAsync();

        (await Send(Ev(), Ev(), Ev(), Ev())).ShouldBe(2);
        (await Send(Ev())).ShouldBe(0);
    }
}
