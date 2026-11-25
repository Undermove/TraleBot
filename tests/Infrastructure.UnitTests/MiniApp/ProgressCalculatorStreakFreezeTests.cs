using System;
using Domain.Entities;
using NUnit.Framework;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.MiniApp;

// Streak freezes (a prize of the gift of the day): each covers one missed day.
[TestFixture]
public class ProgressCalculatorStreakFreezeTests
{
    private static MiniAppUserProgress Played(int daysAgo, int streak, int freezes) => new()
    {
        CompletedLessonsJson = "{}",
        SentenceBuilderProgressJson = "{}",
        Streak = streak,
        StreakFreezes = freezes,
        LastPlayedAtUtc = DateTime.UtcNow.Date.AddDays(-daysAgo).AddHours(9)
    };

    [Test]
    public void A_freeze_covers_a_missed_day_and_is_used_up()
    {
        var progress = Played(daysAgo: 2, streak: 5, freezes: 2);

        new ProgressCalculator().CreditPractice(progress, 10);

        progress.Streak.ShouldBe(6);
        progress.StreakFreezes.ShouldBe(1);
    }

    [Test]
    public void Not_enough_freezes_the_streak_starts_over_and_they_stay()
    {
        var progress = Played(daysAgo: 4, streak: 5, freezes: 2);

        new ProgressCalculator().CreditPractice(progress, 10);

        progress.Streak.ShouldBe(1);
        progress.StreakFreezes.ShouldBe(2);
    }

    [Test]
    public void Playing_yesterday_keeps_the_freezes()
    {
        var progress = Played(daysAgo: 1, streak: 5, freezes: 1);

        new ProgressCalculator().CreditPractice(progress, 10);

        progress.Streak.ShouldBe(6);
        progress.StreakFreezes.ShouldBe(1);
    }
}
