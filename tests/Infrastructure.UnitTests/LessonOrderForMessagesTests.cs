using System.Text.RegularExpressions;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests;

// Messages to learners (first-week reminders) name the next lesson by its title and goal: the order must be
// the one the mini-app shows, and every Georgian word must come with its Cyrillic reading.
public class LessonOrderForMessagesTests
{
    private static readonly MiniAppContentProvider Content = new();

    [Test]
    public void Alphabet_words_lesson_comes_right_after_its_letters_lesson()
    {
        var order = Content.LessonOrder("alphabet-progressive").Select(l => l.Id).ToList();

        order[0].ShouldBe(1);
        order[1].ShouldBe(12, "after the first letters lesson come its words, not letters lesson 2");
        order.ShouldContain(2);
        Content.ModuleTitle("alphabet-progressive").ShouldBe("Алфавит");
    }

    [Test]
    public void Unknown_module_has_no_lessons() =>
        Content.LessonOrder("no-such-module").ShouldBeEmpty();

    [Test]
    public void Georgian_words_carry_their_reading()
    {
        MiniAppContentProvider.WithReading("Слова: და, არა").ShouldBe("Слова: და (да), არა (ара)");
    }

    [Test]
    public void Every_lesson_title_and_goal_reads_as_whole_words_with_readings()
    {
        var glued = new Regex("[\\u0400-\\u04FF][\\u10D0-\\u10FF]|[\\u10D0-\\u10FF][\\u0400-\\u04FF]");
        var bare = new Regex("[\\u10D0-\\u10FF]+(?![\\u10D0-\\u10FF]| \\()");
        foreach (var module in Content.GetCatalog().Modules)
        foreach (var l in Content.LessonOrder(module.Id))
        foreach (var text in new[] { l.Title, l.Goal })
        {
            glued.IsMatch(text).ShouldBeFalse($"{module.Id}/{l.Id}: a Georgian letter glued to Russian — «{text}»");
            bare.IsMatch(text).ShouldBeFalse($"{module.Id}/{l.Id}: Georgian without its reading — «{text}»");
        }
    }
}
