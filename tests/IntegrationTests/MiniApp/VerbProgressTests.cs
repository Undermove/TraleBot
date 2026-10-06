using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Per-form progress of the verb "ladder": what the mini-app saves after each answer, how replays
/// are absorbed, and when a mastered form becomes due again — against real Postgres.
/// </summary>
public class VerbProgressTests : TestBase
{
    private const string Write = "წერს";
    private static readonly DateTime Now = new(2026, 10, 5, 18, 0, 0, DateTimeKind.Utc);

    private Guid _userId;

    private static string CatalogJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = _testServer.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    private Task<VerbProgressState?> Save(DateTime now, params VerbFormStep[] steps) =>
        InScope(sp => sp.GetRequiredService<VerbProgressService>().SaveAsync(_userId, Write, steps, now, CancellationToken.None));

    private Task<VerbProgressState?> Get(DateTime now, string lemma = Write) =>
        InScope(sp => sp.GetRequiredService<VerbProgressService>().GetAsync(_userId, lemma, now, CancellationToken.None));

    private Task<VerbProgressSummary> Summary(DateTime now) =>
        InScope(sp => sp.GetRequiredService<VerbProgressService>().GetSummaryAsync(_userId, now, CancellationToken.None));

    [SetUp]
    public async Task SeedCatalogAndUser()
    {
        _userId = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None);

            var user = Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(user);
            await db.SaveChangesAsync(CancellationToken.None);
            return user.Id;
        });
    }

    [Test]
    public async Task Untouched_verb_has_no_progress_but_can_be_learned()
    {
        var state = await Get(Now);

        state!.CanLearn.Should().BeTrue();
        state.Forms.Should().BeEmpty();
        state.Total.Should().Be(36, because: "six main tenses × six persons, all present for a regular verb");
    }

    [Test]
    public async Task Unknown_verb_has_no_progress_state()
    {
        var state = await Get(Now, "არარსებული");

        state.Should().BeNull();
    }

    [Test]
    public async Task Unreviewed_verb_cannot_be_learned_and_ignores_saves()
    {
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = await db.Verbs.SingleAsync(v => v.Lemma == Write);
            verb.Status = VerbStatus.Generated;
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var state = await Save(Now, new VerbFormStep("present", 0, 2, 0, Now));
        var rows = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbFormProgresses.CountAsync(p => p.UserId == _userId));

        state!.CanLearn.Should().BeFalse();
        rows.Should().Be(0, because: "forms made by a model are not drilled until someone has reviewed them");
    }

    [Test]
    public async Task Saved_steps_come_back_on_load()
    {
        await Save(Now, new VerbFormStep("present", 0, 3, 0, Now), new VerbFormStep("future", 0, 1, 0, Now));

        var state = await Get(Now);

        state!.Forms.Select(f => (f.Tense, f.Person, f.Step)).Should().BeEquivalentTo(new[]
        {
            ("present", 0, 3), ("future", 0, 1)
        });
        state.Forms.Should().OnlyContain(f => !f.Due && f.NextDueAtUtc == null);
    }

    [Test]
    public async Task Replaying_the_same_batch_changes_nothing()
    {
        var batch = new[] { new VerbFormStep("present", 0, 6, 0, Now) };
        var first = await Save(Now, batch);

        var replay = await Save(Now.AddMinutes(30), batch);
        var rows = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbFormProgresses.CountAsync(p => p.UserId == _userId));

        rows.Should().Be(1);
        replay!.Forms.Should().BeEquivalentTo(first!.Forms);
    }

    [Test]
    public async Task Late_arriving_older_answer_does_not_roll_a_form_back()
    {
        await Save(Now, new VerbFormStep("present", 0, 4, 0, Now));

        var state = await Save(Now.AddMinutes(1), new VerbFormStep("present", 0, 2, 0, Now.AddMinutes(-5)));

        state!.Forms.Single().Step.Should().Be(4);
    }

    [Test]
    public async Task Mistake_lowers_the_step_but_not_the_best_step()
    {
        await Save(Now, new VerbFormStep("present", 0, 4, 0, Now));

        var state = await Save(Now.AddMinutes(1), new VerbFormStep("present", 0, 3, 0, Now.AddMinutes(1)));

        state!.Forms.Single().Step.Should().Be(3);
        state.Forms.Single().BestStep.Should().Be(4, because: "the progress the learner sees never goes backwards");
    }

    [Test]
    public async Task Several_answers_for_one_form_in_a_batch_keep_the_latest()
    {
        var state = await Save(Now,
            new VerbFormStep("present", 0, 3, 0, Now.AddSeconds(-10)),
            new VerbFormStep("present", 0, 2, 0, Now.AddSeconds(-20)));

        state!.Forms.Single().Step.Should().Be(3);
    }

    [Test]
    public async Task Steps_for_cells_the_verb_does_not_have_are_skipped_without_failing_the_batch()
    {
        var state = await Save(Now,
            new VerbFormStep("present", 0, 2, 0, Now),
            new VerbFormStep("present", 9, 2, 0, Now),
            new VerbFormStep("perfect", 0, 2, 0, Now),
            new VerbFormStep("nonsense", 0, 2, 0, Now),
            new VerbFormStep("aorist", 0, 0, 0, Now),
            new VerbFormStep("aorist", 1, 7, 0, Now));

        state!.Forms.Select(f => (f.Tense, f.Person)).Should().Equal(("present", 0));
    }

    [Test]
    public async Task Mastered_form_becomes_due_the_next_day_and_not_before()
    {
        await Save(Now, new VerbFormStep("present", 0, 6, 0, Now));

        var sameEvening = await Get(Now.AddHours(3));
        var nextEvening = await Get(Now.AddHours(21));

        sameEvening!.Forms.Single().Due.Should().BeFalse();
        nextEvening!.Forms.Single().Due.Should().BeTrue(because: "a learner who comes back a bit earlier the next day still gets yesterday's forms");
    }

    [Test]
    public async Task Each_successful_repetition_pushes_the_form_out_by_a_short_fixed_interval()
    {
        await Save(Now, new VerbFormStep("present", 0, 6, 0, Now));
        var firstReview = Now.AddDays(1);
        await Save(firstReview, new VerbFormStep("present", 0, 6, 1, firstReview));
        var secondReview = firstReview.AddDays(2);
        var afterSecond = await Save(secondReview, new VerbFormStep("present", 0, 6, 2, secondReview));
        var thirdReview = secondReview.AddDays(3);
        var afterThird = await Save(thirdReview, new VerbFormStep("present", 0, 6, 3, thirdReview));

        afterSecond!.Forms.Single().NextDueAtUtc.Should().Be(secondReview + VerbProgressService.RepeatAfter(2));
        afterThird!.Forms.Single().NextDueAtUtc.Should().Be(thirdReview + VerbProgressService.RepeatAfter(3));
        VerbProgressService.RepeatAfter(3).Should().Be(VerbProgressService.RepeatAfter(2),
            because: "intervals stay within 1–3 days instead of expanding");
        (await Get(thirdReview))!.Forms.Single().Reviews.Should().Be(3);
    }

    [Test]
    public async Task Failed_repetition_takes_the_form_off_the_schedule_until_mastered_again()
    {
        await Save(Now, new VerbFormStep("present", 0, 6, 0, Now));
        var review = Now.AddDays(1);

        var failed = await Save(review, new VerbFormStep("present", 0, 5, 0, review));
        var again = await Save(review.AddMinutes(2), new VerbFormStep("present", 0, 6, 0, review.AddMinutes(2)));

        failed!.Forms.Single().NextDueAtUtc.Should().BeNull();
        failed.Forms.Single().Due.Should().BeFalse();
        again!.Forms.Single().NextDueAtUtc.Should().Be(review.AddMinutes(2) + VerbProgressService.RepeatAfter(0));
    }

    [Test]
    public async Task Answer_stamped_in_the_future_is_treated_as_given_now()
    {
        var state = await Save(Now, new VerbFormStep("present", 0, 6, 0, Now.AddDays(30)));
        var next = await Save(Now.AddMinutes(1), new VerbFormStep("present", 0, 5, 0, Now.AddMinutes(1)));

        state!.Forms.Single().NextDueAtUtc.Should().Be(Now + VerbProgressService.RepeatAfter(0));
        next!.Forms.Single().Step.Should().Be(5, because: "a clock running ahead must not make an answer unbeatable");
    }

    [Test]
    public async Task Summary_lists_verbs_in_progress_with_counts_and_due_forms()
    {
        await Save(Now,
            new VerbFormStep("present", 0, 6, 0, Now),
            new VerbFormStep("aorist", 0, 6, 0, Now),
            new VerbFormStep("future", 0, 2, 0, Now));
        await InScope(sp => sp.GetRequiredService<VerbProgressService>().SaveAsync(
            _userId, "მიდის", new[] { new VerbFormStep("present", 0, 1, 0, Now.AddMinutes(5)) }, Now.AddMinutes(5), CancellationToken.None));

        var fresh = await Summary(Now.AddMinutes(10));
        var nextDay = await Summary(Now.AddDays(1));

        fresh.DueForms.Should().Be(0);
        fresh.Verbs.Select(v => v.Lemma).Should().Equal("მიდის", Write);
        var write = nextDay.Verbs.Single(v => v.Lemma == Write);
        write.Should().BeEquivalentTo(new { Started = 3, Mastered = 2, Total = 36, Due = 2, Title = "წერა" });
        nextDay.DueForms.Should().Be(2);
    }

    [Test]
    public async Task Summary_is_empty_for_a_user_who_has_not_started_any_verb()
    {
        var summary = await Summary(Now);

        summary.Verbs.Should().BeEmpty();
        summary.DueForms.Should().Be(0);
    }

    [Test]
    public async Task Progress_survives_a_catalog_reseed_of_a_changed_verb()
    {
        await Save(Now, new VerbFormStep("present", 0, 4, 0, Now));
        var catalog = System.Text.Json.Nodes.JsonNode.Parse(CatalogJson())!;
        catalog["verbs"]![0]!.AsObject()["ru"] = "писать (правка)";

        await InScope(sp => sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog.ToJsonString(), CancellationToken.None));
        var state = await Get(Now);

        state!.Forms.Single().Step.Should().Be(4);
    }

    [Test]
    public async Task Progress_endpoints_require_authentication()
    {
        var client = _testServer.CreateClient();

        var summary = await client.GetAsync("/api/miniapp/verbs/progress");
        var load = await client.GetAsync($"/api/miniapp/verbs/{Write}/progress");
        var save = await client.PostAsync($"/api/miniapp/verbs/{Write}/progress",
            new StringContent("{\"forms\":[]}", System.Text.Encoding.UTF8, "application/json"));

        summary.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
        load.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
        save.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
