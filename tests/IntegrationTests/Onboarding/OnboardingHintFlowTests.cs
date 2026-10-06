using Application.Common;
using Application.MiniApp.Commands;
using Application.MiniApp.Queries;
using Application.Onboarding;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Onboarding;

/// <summary>
/// End-to-end (against real Postgres) for the contextual onboarding engine: me() surfaces the
/// active hint, marking it seen persists, and the next me() falls silent (cooldown + seen).
/// </summary>
public class OnboardingHintFlowTests : TestBase
{
    [Test]
    public async Task Me_surfaces_the_first_lesson_hint_then_falls_silent_once_marked_seen()
    {
        var telegramId = 880011L;
        var userId = await SeedWelcomedUserAsync(telegramId);

        // me() #1 → the user only finished the welcome lesson, so nudge them to a real lesson.
        var first = await SendAsync(new GetMiniAppProfile { UserId = userId });
        first.OnboardingHint.Should().Be(OnboardingHints.FirstLesson);

        // Mark it seen (what the mini-app does when it renders the nudge).
        var marked = await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = OnboardingHints.FirstLesson });
        marked.Should().BeTrue();

        // me() #2 → nothing new within the cooldown window.
        var second = await SendAsync(new GetMiniAppProfile { UserId = userId });
        second.OnboardingHint.Should().BeNull();

        // The seen state is persisted on the progress row.
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var progress = await db.MiniAppUserProgresses.FirstAsync(p => p.UserId == userId);
        OnboardingState.Parse(progress.OnboardingHintsJson).Seen.Should().Contain(OnboardingHints.FirstLesson);
    }

    [Test]
    public async Task Marking_an_unknown_hint_is_rejected()
    {
        var userId = await SeedWelcomedUserAsync(880022L);
        var ok = await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = "not_a_real_hint" });
        ok.Should().BeFalse();
    }

    [Test]
    public async Task Interface_hint_is_remembered_for_every_device_and_does_not_delay_the_onboarding_step()
    {
        var userId = await SeedWelcomedUserAsync(880033L);

        // A verb game showed its rules: the mini-app marks the hint through the same endpoint.
        (await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = "ui:verb_game_seen_verb_time" })).Should().BeTrue();
        (await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = "ui:verb_game_seen_verb_time" })).Should().BeTrue();
        (await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = "ui:verb_card_person" })).Should().BeTrue();

        // Any later me() — after a reload, on another device — carries the seen hints…
        var me = await SendAsync(new GetMiniAppProfile { UserId = userId });
        me.UiHintsSeen.Should().Equal("ui:verb_card_person", "ui:verb_game_seen_verb_time");
        // …and the onboarding step is still offered: an interface hint is not a step and starts no gap.
        me.OnboardingHint.Should().Be(OnboardingHints.FirstLesson);

        // Marking the onboarding step keeps the interface hints.
        await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = OnboardingHints.FirstLesson });
        (await SendAsync(new GetMiniAppProfile { UserId = userId })).UiHintsSeen.Should().HaveCount(2);
    }

    [TestCase("ui:Has Spaces")]
    [TestCase("ui:")]
    [TestCase("ui:<script>")]
    [TestCase("verb_card_person")]
    public async Task Malformed_interface_hint_keys_are_rejected(string key)
    {
        var userId = await SeedWelcomedUserAsync(Random.Shared.NextInt64(900000, 990000));
        (await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = key })).Should().BeFalse();
        (await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = "ui:" + new string('a', 80) })).Should().BeFalse();
    }

    [Test]
    public async Task Interface_hints_list_cannot_grow_without_limit()
    {
        var userId = await SeedWelcomedUserAsync(880044L);
        for (var i = 0; i < OnboardingHints.MaxUiHints + 5; i++)
        {
            await SendAsync(new MarkOnboardingHintSeen { UserId = userId, HintKey = $"ui:hint_{i}" });
        }

        (await SendAsync(new GetMiniAppProfile { UserId = userId })).UiHintsSeen.Should().HaveCount(OnboardingHints.MaxUiHints);
    }

    private async Task<T> SendAsync<T>(IRequest<T> request)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
        return await mediator.Send(request);
    }

    private async Task<System.Guid> SeedWelcomedUserAsync(long telegramId)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(telegramId, "OnboardingTest");
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);

        db.UsersSettings.Add(new UserSettings
        {
            Id = System.Guid.NewGuid(),
            UserId = user.Id,
            CurrentLanguage = Language.Georgian,
        });

        db.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = System.Guid.NewGuid(),
            UserId = user.Id,
            CompletedLessonsJson = """{"welcome":[1]}""",
            Xp = 20,
            CreatedAtUtc = System.DateTime.UtcNow,
            UpdatedAtUtc = System.DateTime.UtcNow,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        return user.Id;
    }
}
