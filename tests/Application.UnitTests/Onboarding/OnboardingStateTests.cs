using System;
using Application.Onboarding;
using Domain.Entities;
using NUnit.Framework;
using Shouldly;

namespace Application.UnitTests.Onboarding;

[TestFixture]
public class OnboardingStateTests
{
    [Test]
    public void Parse_null_or_blank_yields_empty_state()
    {
        var s = OnboardingState.Parse(null);
        s.Seen.ShouldBeEmpty();
        s.LastShownAt.ShouldBeNull();

        OnboardingState.Parse("   ").Seen.ShouldBeEmpty();
    }

    [Test]
    public void Parse_garbage_yields_empty_state_rather_than_throwing()
    {
        var s = OnboardingState.Parse("{not valid json");
        s.Seen.ShouldBeEmpty();
        s.LastShownAt.ShouldBeNull();
    }

    [Test]
    public void MarkSeen_records_the_key_and_timestamp_and_round_trips()
    {
        var now = new DateTime(2026, 6, 18, 9, 0, 0, DateTimeKind.Utc);

        var json = OnboardingState.MarkSeen(null, OnboardingHints.FirstLesson, now);
        var state = OnboardingState.Parse(json);

        state.Seen.ShouldContain(OnboardingHints.FirstLesson);
        state.LastShownAt!.Value.ShouldBe(now);
    }

    [Test]
    public void MarkSeen_accumulates_keys()
    {
        var t1 = new DateTime(2026, 6, 18, 9, 0, 0, DateTimeKind.Utc);
        var t2 = t1.AddDays(1);

        var json = OnboardingState.MarkSeen(null, OnboardingHints.FirstLesson, t1);
        json = OnboardingState.MarkSeen(json, OnboardingHints.NextLesson, t2);

        var state = OnboardingState.Parse(json);
        state.Seen.ShouldContain(OnboardingHints.FirstLesson);
        state.Seen.ShouldContain(OnboardingHints.NextLesson);
        state.LastShownAt!.Value.ShouldBe(t2);
    }

    [Test]
    public void BuildSignals_excludes_the_welcome_module_from_real_progress()
    {
        var progress = new MiniAppUserProgress
        {
            CompletedLessonsJson = """{"welcome":[1],"alphabet-progressive":[1,2]}""",
            Xp = 40,
            XpSpent = 10,
            TotalTreatsGiven = 2,
        };

        var signals = OnboardingState.BuildSignals(progress, vocabularyCount: 5);

        signals.RealLessonsCompleted.ShouldBe(2); // welcome's lesson is not counted
        signals.DistinctRealModules.ShouldBe(1);
        signals.AvailableXp.ShouldBe(30);
        signals.TotalTreatsGiven.ShouldBe(2);
        signals.VocabularyCount.ShouldBe(5);
    }

    [Test]
    public void BuildSignals_treats_only_welcome_as_zero_real_lessons()
    {
        var progress = new MiniAppUserProgress
        {
            CompletedLessonsJson = """{"welcome":[1]}""",
            Xp = 20,
        };

        var signals = OnboardingState.BuildSignals(progress, vocabularyCount: 0);

        signals.RealLessonsCompleted.ShouldBe(0);
        signals.DistinctRealModules.ShouldBe(0);
    }
}
