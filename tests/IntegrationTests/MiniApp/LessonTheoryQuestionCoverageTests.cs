using System.Net;
using System.Text.Json;
using FluentAssertions;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Every Georgian word tested in a lesson's quiz must appear in some theory screen
/// the user has already seen — either in this lesson's own theory, or in a prior
/// lesson of the same module (revision lessons are allowed to test earlier vocab).
/// Otherwise the user is asked about vocabulary they never saw before the quiz —
/// the class of bug reported for module "Знакомство" lesson 2, where "სახელი",
/// "ასაკი" and "ოჯახი" were asked but none were introduced in theory.
/// </summary>
public class LessonTheoryQuestionCoverageTests : TestBase
{
    // Modules with hand-written theory + lemma-based quizzes whose theory already
    // covers every quiz lemma. Alphabet modules are intentionally excluded — they
    // use a letter-symbol question format and are guarded by
    // AlphabetProgressiveLettersCoverageTests.
    //
    // TODO (content backlog): the following modules currently have quizzes asking
    // about lemmas that were never shown in their theory screens and should be
    // brought up to this standard one by one, then re-added to this list:
    //   adjectives, aorist, imperfect, postpositions,
    //   preverbs, pronoun-declension, pronouns, verb-classes, verbs-of-movement,
    //   version-vowels
    // Run this test suite locally with those ids temporarily added to see the
    // concrete list of missing lemmas per lesson.
    // Only modules that are exposed via /api/miniapp/content AND currently pass
    // the coverage rule. Some vocab-* modules live in ModuleRegistry but are not
    // surfaced in the public catalog and so are intentionally skipped here.
    private static readonly string[] VocabularyModuleIds =
    {
        "intro",
        "cases",
        "conditionals",
        "numbers",
        "present-tense"
    };

    [Test]
    public async Task Intro_module_every_quiz_lemma_appears_in_its_lesson_theory()
    {
        // Scoped narrow first — this is the specific module the user reported.
        await AssertCoverageForModule("intro");
    }

    [TestCaseSource(nameof(VocabularyModuleIds))]
    public async Task Every_quiz_lemma_appears_in_its_lesson_theory(string moduleId)
    {
        await AssertCoverageForModule(moduleId);
    }

    private async Task AssertCoverageForModule(string moduleId)
    {
        var client = _testServer.CreateClient();
        var module = await FetchModuleAsync(client, moduleId);

        // Build per-lesson theory text and a cumulative (this lesson + all prior lessons)
        // aggregate — revision lessons can legitimately re-use earlier vocabulary.
        var lessons = module.GetProperty("lessons").EnumerateArray()
            .Select(l => new
            {
                Id = l.GetProperty("id").GetInt32(),
                TheoryText = CollectTheoryText(l)
            })
            .OrderBy(l => l.Id)
            .ToList();

        var cumulative = new Dictionary<int, string>();
        var acc = new System.Text.StringBuilder();
        foreach (var l in lessons)
        {
            acc.Append(l.TheoryText).Append('\n');
            cumulative[l.Id] = acc.ToString();
        }

        var failures = new List<string>();
        foreach (var l in lessons)
        {
            var qResp = await client.GetAsync($"/api/miniapp/modules/{moduleId}/lessons/{l.Id}/questions");
            if (qResp.StatusCode != HttpStatusCode.OK) continue;

            var body = await qResp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) continue;

            var lemmas = new HashSet<string>();
            foreach (var q in doc.RootElement.EnumerateArray())
            {
                if (q.TryGetProperty("lemma", out var lemmaEl)
                    && lemmaEl.ValueKind == JsonValueKind.String)
                {
                    var lemma = lemmaEl.GetString();
                    if (!string.IsNullOrWhiteSpace(lemma)) lemmas.Add(lemma!);
                }
            }

            var seenSoFar = cumulative[l.Id];
            foreach (var lemma in lemmas)
            {
                if (!seenSoFar.Contains(lemma, StringComparison.Ordinal))
                {
                    failures.Add($"  [{moduleId}/lesson{l.Id}] quiz asks about '{lemma}' but it was never shown in this or any prior lesson's theory");
                }
            }
        }

        failures.Should().BeEmpty(
            because: "a learner should not be quizzed on vocabulary that was never shown in this or any earlier lesson of the module. " +
                     "Failures:\n" + string.Join("\n", failures));
    }

    private static async Task<JsonElement> FetchModuleAsync(HttpClient client, string moduleId)
    {
        var response = await client.GetAsync("/api/miniapp/content");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        foreach (var m in doc.RootElement.GetProperty("modules").EnumerateArray())
        {
            if (m.GetProperty("id").GetString() == moduleId)
            {
                return m.Clone();
            }
        }

        throw new InvalidOperationException($"Module '{moduleId}' not found in catalog");
    }

    private static string CollectTheoryText(JsonElement lesson)
    {
        var parts = new List<string>();
        if (!lesson.TryGetProperty("theory", out var theory)) return string.Empty;
        if (!theory.TryGetProperty("blocks", out var blocks)) return string.Empty;

        foreach (var block in blocks.EnumerateArray())
        {
            var type = block.TryGetProperty("type", out var t) ? t.GetString() : null;
            switch (type)
            {
                case "paragraph":
                    if (block.TryGetProperty("text", out var pText)) parts.Add(pText.GetString() ?? "");
                    break;
                case "list":
                    if (block.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var i in items.EnumerateArray()) parts.Add(i.GetString() ?? "");
                    }
                    break;
                case "example":
                    if (block.TryGetProperty("ge", out var ge)) parts.Add(ge.GetString() ?? "");
                    if (block.TryGetProperty("ru", out var ru)) parts.Add(ru.GetString() ?? "");
                    break;
                case "letters":
                    if (block.TryGetProperty("letters", out var letters) && letters.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var l in letters.EnumerateArray())
                        {
                            if (l.TryGetProperty("letter", out var letter)) parts.Add(letter.GetString() ?? "");
                            if (l.TryGetProperty("exampleGe", out var ex)) parts.Add(ex.GetString() ?? "");
                        }
                    }
                    break;
            }
        }
        return string.Join("\n", parts);
    }
}
