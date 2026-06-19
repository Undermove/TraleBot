using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using Domain.Entities;
using NUnit.Framework;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.MiniApp;

// Guards the per-day activity log that backs the profile heatmap: a daily mini-app
// learner must light up one cell PER played day, not just the single LastPlayedAtUtc.
[TestFixture]
public class ProgressCalculatorActivityDaysTests
{
    private static MiniAppUserProgress NewProgress(string? activityDaysJson = null) => new()
    {
        CompletedLessonsJson = "{}",
        SentenceBuilderProgressJson = "{}",
        ActivityDaysJson = activityDaysJson
    };

    private static List<DateTime> ParseDays(string? json) =>
        JsonSerializer.Deserialize<List<string>>(json!)!
            .ConvertAll(s => DateTime.Parse(s, null, DateTimeStyles.AdjustToUniversal).ToUniversalTime());

    [Test]
    public void Records_today_and_preserves_prior_days()
    {
        var calc = new ProgressCalculator();
        var fiveDaysAgo = DateTime.UtcNow.Date.AddDays(-5).AddHours(9);
        var progress = NewProgress(JsonSerializer.Serialize(
            new[] { fiveDaysAgo.ToString("yyyy-MM-ddTHH:mm:ssZ") }));

        calc.CalculateLessonCompletion(progress, "verbs", 1, 3, 3);

        var days = ParseDays(progress.ActivityDaysJson);
        days.Count.ShouldBe(2); // prior day kept + today appended
        days.ShouldContain(d => d.Date == DateTime.UtcNow.Date);
        days.ShouldContain(d => d.Date == fiveDaysAgo.Date);
    }

    [Test]
    public void Does_not_duplicate_when_played_twice_same_day()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress();

        calc.CalculateLessonCompletion(progress, "verbs", 1, 3, 3);
        calc.CalculateLessonCompletion(progress, "verbs", 2, 3, 3);

        ParseDays(progress.ActivityDaysJson).Count.ShouldBe(1);
    }

    [Test]
    public void Starts_log_when_json_is_null()
    {
        var calc = new ProgressCalculator();
        var progress = NewProgress(activityDaysJson: null);

        calc.CalculateLessonCompletion(progress, "verbs", 1, 2, 3);

        progress.ActivityDaysJson.ShouldNotBeNull();
        ParseDays(progress.ActivityDaysJson).Count.ShouldBe(1);
    }
}
