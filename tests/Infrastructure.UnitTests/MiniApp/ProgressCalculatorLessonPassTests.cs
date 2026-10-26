using System.Collections.Generic;
using System.Text.Json;
using Domain.Entities;
using NUnit.Framework;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.MiniApp;

// A beginner who slips once in an alphabet lesson check still passes it: one wrong tap out of four
// was where newcomers dropped off. Other modules still want every answer right.
[TestFixture]
public class ProgressCalculatorLessonPassTests
{
    private static MiniAppUserProgress NewProgress() => new()
    {
        CompletedLessonsJson = "{}",
        SentenceBuilderProgressJson = "{}"
    };

    private static List<int> Completed(MiniAppUserProgress progress, string moduleId) =>
        JsonSerializer.Deserialize<Dictionary<string, List<int>>>(progress.CompletedLessonsJson)!
            .GetValueOrDefault(moduleId) ?? new List<int>();

    [Test]
    public void Alphabet_lesson_with_one_mistake_is_passed_and_pays_like_a_perfect_one()
    {
        var progress = NewProgress();

        var update = new ProgressCalculator().CalculateLessonCompletion(progress, "alphabet-progressive", 12, 3, 4);

        update.LessonCompleted.ShouldBeTrue();
        update.XpEarned.ShouldBe(20);
        Completed(progress, "alphabet-progressive").ShouldContain(12);
    }

    [Test]
    public void Alphabet_lesson_with_two_mistakes_is_not_passed()
    {
        var progress = NewProgress();

        var update = new ProgressCalculator().CalculateLessonCompletion(progress, "alphabet-progressive", 12, 2, 4);

        update.LessonCompleted.ShouldBeFalse();
        Completed(progress, "alphabet-progressive").ShouldBeEmpty();
    }

    [Test]
    public void Other_modules_still_want_every_answer_right()
    {
        var progress = NewProgress();

        var update = new ProgressCalculator().CalculateLessonCompletion(progress, "verbs-of-movement", 3, 5, 6);

        update.LessonCompleted.ShouldBeFalse();
    }
}
