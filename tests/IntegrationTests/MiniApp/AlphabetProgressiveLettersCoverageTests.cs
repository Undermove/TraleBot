using System.Net;
using System.Text.Json;
using FluentAssertions;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The Profile screen's "My Alphabet" widget reads learned-letter data from the
/// <c>alphabet-progressive</c> module by scanning each lesson's theory blocks for
/// <c>type: "letters"</c>. When progressive lessons lack those blocks, the widget
/// stays stuck at 0 / 33 even after the user completes every lesson.
///
/// These tests pin that contract: alphabet-progressive must declare all 33
/// Georgian letters across its lessons, each letter introduced exactly once.
/// </summary>
public class AlphabetProgressiveLettersCoverageTests : TestBase
{
    private const string ProgressiveModuleId = "alphabet-progressive";

    private static readonly string[] AllGeorgianLetters =
    {
        "ა", "ბ", "გ", "დ", "ე", "ვ", "ზ", "თ", "ი", "კ", "ლ",
        "მ", "ნ", "ო", "პ", "ჟ", "რ", "ს", "ტ", "უ", "ფ", "ქ",
        "ღ", "ყ", "შ", "ჩ", "ც", "ძ", "წ", "ჭ", "ხ", "ჯ", "ჰ"
    };

    [Test]
    public async Task Progressive_module_theory_declares_all_33_letters()
    {
        var lessons = await FetchProgressiveLessonsAsync();

        var introduced = CollectIntroducedLetters(lessons);

        introduced.Should().BeEquivalentTo(
            AllGeorgianLetters,
            because: "profile widget counts learned letters from alphabet-progressive theory blocks; " +
                     "any missing letter means the counter can never reach 33/33 even after all lessons are done");
    }

    [Test]
    public async Task Progressive_module_introduces_each_letter_exactly_once()
    {
        var lessons = await FetchProgressiveLessonsAsync();

        var occurrences = new Dictionary<string, int>();
        foreach (var lesson in lessons)
        {
            foreach (var letter in ExtractLettersBlockSymbols(lesson))
            {
                occurrences[letter] = occurrences.GetValueOrDefault(letter) + 1;
            }
        }

        var duplicates = occurrences.Where(kv => kv.Value > 1).Select(kv => kv.Key).ToArray();
        duplicates.Should().BeEmpty(
            because: "a letter introduced in multiple lessons double-counts learned progress " +
                     "and muddles which lesson 'owns' it — keep theory blocks disjoint");
    }

    [Test]
    public async Task Progressive_module_letters_blocks_carry_dto_fields()
    {
        // Widget needs name, translit, example, exampleRu to render LetterPopover.
        // Empty values slip past the coverage test but break the UI silently.
        var lessons = await FetchProgressiveLessonsAsync();

        foreach (var lesson in lessons)
        {
            foreach (var letterElement in ExtractLettersBlockElements(lesson))
            {
                var letter = letterElement.GetProperty("letter").GetString();
                letter.Should().NotBeNullOrWhiteSpace();

                foreach (var field in new[] { "name", "translit", "exampleGe", "exampleRu" })
                {
                    var hasField = letterElement.TryGetProperty(field, out var v)
                                   && v.ValueKind == JsonValueKind.String
                                   && !string.IsNullOrWhiteSpace(v.GetString());
                    hasField.Should().BeTrue(
                        because: $"letter '{letter}' in alphabet-progressive is missing '{field}' — LetterPopover needs it");
                }
            }
        }
    }

    private async Task<List<JsonElement>> FetchProgressiveLessonsAsync()
    {
        var client = _testServer.CreateClient();
        var response = await client.GetAsync("/api/miniapp/content");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        var modules = doc.RootElement.GetProperty("modules");
        JsonElement progressive = default;
        var found = false;
        foreach (var m in modules.EnumerateArray())
        {
            if (m.GetProperty("id").GetString() == ProgressiveModuleId)
            {
                progressive = m.Clone();
                found = true;
                break;
            }
        }
        found.Should().BeTrue(because: "catalog must expose alphabet-progressive");

        return progressive.GetProperty("lessons").EnumerateArray().ToList();
    }

    private static HashSet<string> CollectIntroducedLetters(IEnumerable<JsonElement> lessons)
    {
        var set = new HashSet<string>();
        foreach (var lesson in lessons)
        {
            foreach (var letter in ExtractLettersBlockSymbols(lesson))
            {
                set.Add(letter);
            }
        }
        return set;
    }

    private static IEnumerable<string> ExtractLettersBlockSymbols(JsonElement lesson)
    {
        foreach (var el in ExtractLettersBlockElements(lesson))
        {
            if (el.TryGetProperty("letter", out var letter) && letter.ValueKind == JsonValueKind.String)
            {
                yield return letter.GetString()!;
            }
        }
    }

    private static IEnumerable<JsonElement> ExtractLettersBlockElements(JsonElement lesson)
    {
        if (!lesson.TryGetProperty("theory", out var theory)) yield break;
        if (!theory.TryGetProperty("blocks", out var blocks)) yield break;

        foreach (var block in blocks.EnumerateArray())
        {
            if (!block.TryGetProperty("type", out var type)) continue;
            if (type.GetString() != "letters") continue;
            if (!block.TryGetProperty("letters", out var letters)) continue;
            if (letters.ValueKind != JsonValueKind.Array) continue;

            foreach (var el in letters.EnumerateArray())
            {
                yield return el;
            }
        }
    }
}
