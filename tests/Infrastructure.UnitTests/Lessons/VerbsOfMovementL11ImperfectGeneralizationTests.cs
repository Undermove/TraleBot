using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.Lessons;

/// <summary>
/// Guards L11 (Прошедшее несовершённое) of the Verbs-of-Movement module
/// against the regression described in issue #728: only the მი- direction
/// was taught and no generalisation for the other five preverbs was given.
/// </summary>
public class VerbsOfMovementL11ImperfectGeneralizationTests
{
    private static readonly MiniAppContentProvider Provider = new();

    private static string GetL11TheoryText()
    {
        var module = Provider.GetCatalog().Modules
            .First(m => m.Id == "verbs-of-movement");
        var lesson = module.Lessons.First(l => l.Id == 11);
        return string.Concat(
            lesson.Theory.Blocks
                .SelectMany(b =>
                {
                    var parts = new List<string>();
                    if (b.Text is not null) parts.Add(b.Text);
                    if (b.Items is not null) parts.AddRange(b.Items);
                    if (b.Ge is not null) parts.Add(b.Ge);
                    if (b.Ru is not null) parts.Add(b.Ru);
                    return parts;
                }));
    }

    [Test]
    public void vom_l11_theory_mentions_all_five_other_direction_preverbs()
    {
        var text = GetL11TheoryText();

        text.Contains("მო-").ShouldBeTrue("Theory must mention მო- direction preverb");
        text.Contains("შე-").ShouldBeTrue("Theory must mention შე- direction preverb");
        text.Contains("გა-").ShouldBeTrue("Theory must mention გა- direction preverb");
        text.Contains("ა-").ShouldBeTrue("Theory must mention ა- direction preverb");
        text.Contains("ჩა-").ShouldBeTrue("Theory must mention ჩა- direction preverb");
    }

    [Test]
    public void vom_l11_theory_includes_at_least_five_concrete_imperfect_forms_with_different_preverbs()
    {
        var text = GetL11TheoryText();

        // At least five concrete imperfect forms with non-მი- preverbs must be present.
        var forms = new[]
        {
            "მოდიოდ",   // მო-direction imperfect stem
            "შედიოდ",   // შე-direction
            "გამოდიოდ", // გამო-direction
            "ადიოდ",    // ა-direction
            "ჩადიოდ",   // ჩა-direction
        };

        var foundCount = forms.Count(f => text.Contains(f));
        foundCount.ShouldBeGreaterThanOrEqualTo(5,
            $"Expected at least 5 distinct imperfect forms with different preverbs; found {foundCount}. " +
            $"Looked for: {string.Join(", ", forms)}");
    }

    [Test]
    public void vom_l11_theory_mentions_iod_suffix_invariance_and_person_markers()
    {
        var text = GetL11TheoryText();

        text.Contains("-იოდ-").ShouldBeTrue(
            "Theory must explicitly reference -იოდ- as the invariant imperfect suffix");
    }

    [Test]
    public void vom_l11_remains_single_lesson_after_generalization_added()
    {
        var module = Provider.GetCatalog().Modules
            .First(m => m.Id == "verbs-of-movement");

        // Generalization must be added inline to L11, not as a new lesson.
        module.Lessons.Count.ShouldBe(12,
            "Generalization must be added to L11 content, not as an extra lesson. Module must keep exactly 12 lessons.");
    }

    [Test]
    public void vom_l11_still_contains_original_mi_direction_paradigm()
    {
        var text = GetL11TheoryText();

        text.Contains("მივდიოდი").ShouldBeTrue("L11 must still list the 1sg მი- form მივდიოდი");
        text.Contains("მიდიოდი").ShouldBeTrue("L11 must still list the 2sg მი- form მიდიოდი");
        text.Contains("მიდიოდა").ShouldBeTrue("L11 must still list the 3sg მი- form მიდიოდა");
    }
}
