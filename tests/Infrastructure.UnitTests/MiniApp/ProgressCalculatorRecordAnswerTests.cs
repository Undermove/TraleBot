using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using Application.Common;
using Domain.Entities;
using NUnit.Framework;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.MiniApp;

// Guards partial-progress credit: a correct answer must earn XP and mark the day
// as trained (streak + heatmap) immediately, without finishing the whole lesson.
[TestFixture]
public class ProgressCalculatorRecordAnswerTests
{
    private static MiniAppUserProgress NewProgress() => new()
    {
        CompletedLessonsJson = "{}",
        SentenceBuilderProgressJson = "{}"
    };

    private static List<DateTime> ParseDays(string? json) =>
        JsonSerializer.Deserialize<List<string>>(json!)!
            .ConvertAll(s => DateTime.Parse(s, null, DateTimeStyles.AdjustToUniversal).ToUniversalTime());

    [Test]
    public void Correct_answer_earns_xp_and_marks_day_trained()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();

        var update = calc.RecordAnswer(progress, correct: true);

        update.XpEarned.ShouldBe(LearningConstants.XpRewards.CorrectAnswer);
        progress.Xp.ShouldBe(LearningConstants.XpRewards.CorrectAnswer);
        progress.Streak.ShouldBe(1);
        progress.LastPlayedAtUtc.ShouldNotBeNull();
        ParseDays(progress.ActivityDaysJson).ShouldContain(d => d.Date == DateTime.UtcNow.Date);
    }

    [Test]
    public void Wrong_answer_earns_no_xp_but_still_marks_day_trained()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();

        var update = calc.RecordAnswer(progress, correct: false);

        update.XpEarned.ShouldBe(0);
        progress.Xp.ShouldBe(0);
        progress.Streak.ShouldBe(1);
        ParseDays(progress.ActivityDaysJson).ShouldContain(d => d.Date == DateTime.UtcNow.Date);
    }

    [Test]
    public void Repeated_answers_same_day_keep_streak_and_single_heatmap_day()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();

        calc.RecordAnswer(progress, correct: true);
        calc.RecordAnswer(progress, correct: true);
        calc.RecordAnswer(progress, correct: false);

        progress.Xp.ShouldBe(2 * LearningConstants.XpRewards.CorrectAnswer);
        progress.Streak.ShouldBe(1);
        ParseDays(progress.ActivityDaysJson).Count.ShouldBe(1);
    }

    [Test]
    public void Answer_after_yesterday_extends_streak()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();
        progress.Streak = 3;
        progress.LastPlayedAtUtc = DateTime.UtcNow.AddDays(-1);

        calc.RecordAnswer(progress, correct: true);

        progress.Streak.ShouldBe(4);
    }

    [Test]
    public void Answer_after_gap_resets_streak()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();
        progress.Streak = 5;
        progress.LastPlayedAtUtc = DateTime.UtcNow.AddDays(-3);

        calc.RecordAnswer(progress, correct: true);

        progress.Streak.ShouldBe(1);
    }

    [Test]
    public void Answer_does_not_mark_any_lesson_completed()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();

        calc.RecordAnswer(progress, correct: true);

        progress.CompletedLessonsJson.ShouldBe("{}");
    }
}
