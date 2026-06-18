using System;
using System.Collections.Generic;
using Application.Onboarding;
using NUnit.Framework;
using Shouldly;

namespace Application.UnitTests.Onboarding;

[TestFixture]
public class OnboardingHintsTests
{
    private static readonly DateTime Now = new(2026, 6, 18, 10, 0, 0, DateTimeKind.Utc);

    private static OnboardingSignals Signals(
        int realLessons = 0, int distinctModules = 0, int availableXp = 0,
        int treatsGiven = 0, int vocab = 0, bool completedWelcome = true) =>
        new(realLessons, distinctModules, availableXp, treatsGiven, vocab, completedWelcome);

    private static OnboardingHintState State(DateTime? lastShownAt = null, params string[] seen) =>
        new(new HashSet<string>(seen), lastShownAt);

    [Test]
    public void Fresh_user_who_only_did_welcome_is_nudged_to_the_first_real_lesson()
    {
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 0), State(), Now)
            .ShouldBe(OnboardingHints.FirstLesson);
    }

    [Test]
    public void Existing_user_who_never_did_the_welcome_lesson_gets_no_hints()
    {
        // An established user (registered before the welcome lesson) would otherwise match
        // feed_bombora — but no welcome means they're not in the onboarding journey at all.
        OnboardingHints.ResolveActiveHint(
                Signals(realLessons: 40, availableXp: 200, treatsGiven: 0, vocab: 0, completedWelcome: false),
                State(),
                Now)
            .ShouldBeNull();
    }

    [Test]
    public void After_one_lesson_the_nudge_is_to_keep_going()
    {
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 1, availableXp: 0), State(), Now)
            .ShouldBe(OnboardingHints.NextLesson);
    }

    [Test]
    public void Three_lessons_in_a_single_module_nudges_to_explore_another_module()
    {
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 3, distinctModules: 1), State(), Now)
            .ShouldBe(OnboardingHints.ExploreModule);
    }

    [Test]
    public void Spendable_xp_and_never_fed_nudges_to_feed_bombora()
    {
        // Lesson hints already seen; the next eligible step is feeding.
        OnboardingHints.ResolveActiveHint(
                Signals(realLessons: 1, availableXp: 20, treatsGiven: 0),
                State(seen: OnboardingHints.NextLesson),
                Now)
            .ShouldBe(OnboardingHints.FeedBombora);
    }

    [Test]
    public void Empty_vocabulary_after_a_couple_lessons_nudges_to_add_words()
    {
        OnboardingHints.ResolveActiveHint(
                Signals(realLessons: 2, distinctModules: 1, availableXp: 0, vocab: 0),
                State(seen: OnboardingHints.NextLesson, lastShownAt: null),
                Now)
            .ShouldBe(OnboardingHints.AddVocab);
    }

    [Test]
    public void Already_seen_hints_are_not_shown_again()
    {
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 0), State(seen: OnboardingHints.FirstLesson), Now)
            .ShouldBeNull();
    }

    [Test]
    public void At_most_one_new_hint_per_cooldown_window()
    {
        // A hint was shown 2h ago — too soon to surface the next one.
        var recent = Now.AddHours(-2);
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 1), State(lastShownAt: recent), Now)
            .ShouldBeNull();
    }

    [Test]
    public void Next_hint_unlocks_once_the_cooldown_has_passed()
    {
        var longAgo = Now.AddHours(-21);
        OnboardingHints.ResolveActiveHint(Signals(realLessons: 1), State(lastShownAt: longAgo), Now)
            .ShouldBe(OnboardingHints.NextLesson);
    }

    [Test]
    public void Nothing_to_nudge_returns_null()
    {
        // Deep into the app: many lessons, multiple modules, fed, has vocabulary.
        OnboardingHints.ResolveActiveHint(
                Signals(realLessons: 12, distinctModules: 3, availableXp: 0, treatsGiven: 5, vocab: 9),
                State(),
                Now)
            .ShouldBeNull();
    }
}
