using System.Text.Json;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests;

/// <summary>
/// Static content-validation tests for the Postpositions sentence-builder pilot.
/// No Testcontainers or database required — reads files directly.
/// Covers every AC from the QA test plan on issue #862.
/// </summary>
public class SentenceBuilderContentValidationTests
{
    private static readonly string RepoRoot = FindRepoRoot();

    private static readonly string QuestionsJsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianPostpositions", "questions7.json");

    private static readonly string ContentSpecPath =
        Path.Combine(RepoRoot, "design-specs", "79-sentence-builder-content.md");

    private static readonly string LetterRevealSpecPath =
        Path.Combine(RepoRoot, "design-specs", "68-letter-reveal-system.md");

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "FEATURES.md"))
                && Directory.Exists(Path.Combine(dir.FullName, ".git")))
                return dir.FullName;
            dir = dir.Parent!;
        }
        throw new InvalidOperationException("Could not locate repo root.");
    }

    // ── AC: design-specs/79-sentence-builder-content.md exists and contains sections ───

    [Test]
    public void ContentSpec_FileExists_ContainsRequiredSections()
    {
        File.Exists(ContentSpecPath).ShouldBeTrue(
            $"design-specs/79-sentence-builder-content.md must exist at {ContentSpecPath}");

        var text = File.ReadAllText(ContentSpecPath);

        // Must have L1, L2, L3 sentence pair sections
        text.Contains("L1").ShouldBeTrue("Content spec must include L1 sentence pairs");
        text.Contains("L2").ShouldBeTrue("Content spec must include L2 sentence pairs");
        text.Contains("L3").ShouldBeTrue("Content spec must include L3 sentence pairs");

        // Must contain attribution to review sources
        var hasAttribution = text.Contains("Methodist", StringComparison.OrdinalIgnoreCase)
                             || text.Contains("Native", StringComparison.OrdinalIgnoreCase)
                             || text.Contains("#858", StringComparison.Ordinal);
        hasAttribution.ShouldBeTrue(
            "Content spec must attribute verified pairs to Methodist/Native-reviewer comments on #858");

        // Must contain hints table
        var hasHints = text.Contains("hint", StringComparison.OrdinalIgnoreCase)
                       || text.Contains("подсказка", StringComparison.OrdinalIgnoreCase);
        hasHints.ShouldBeTrue("Content spec must include a hints table");
    }

    // ── AC: questions JSON has 15-20 questions with all required sentence-builder fields ───

    [Test]
    public void QuestionsJson_QuestionCount_AndAllRequiredFieldsPresent()
    {
        File.Exists(QuestionsJsonPath).ShouldBeTrue(
            $"questions7.json must exist at {QuestionsJsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsJsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "JSON must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeInRange(15, 20,
            $"questions7.json must contain 15-20 sentence-builder questions, found {count}");

        var idx = 0;
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : $"[index {idx}]";
            idx++;

            q.TryGetProperty("questionType", out var qt).ShouldBeTrue(
                $"Question '{id}' must have 'questionType'");
            qt.GetString().ShouldBe("sentence-builder",
                $"Question '{id}' questionType must be 'sentence-builder'");

            q.TryGetProperty("level", out _).ShouldBeTrue(
                $"Question '{id}' must have 'level'");

            q.TryGetProperty("correctOrder", out var co).ShouldBeTrue(
                $"Question '{id}' must have 'correctOrder'");
            co.ValueKind.ShouldBe(JsonValueKind.Array,
                $"Question '{id}' correctOrder must be an array");
            co.GetArrayLength().ShouldBeGreaterThan(0,
                $"Question '{id}' correctOrder must not be empty");

            q.TryGetProperty("chipPool", out var cp).ShouldBeTrue(
                $"Question '{id}' must have 'chipPool'");
            cp.ValueKind.ShouldBe(JsonValueKind.Array,
                $"Question '{id}' chipPool must be an array");
            cp.GetArrayLength().ShouldBeGreaterThan(0,
                $"Question '{id}' chipPool must not be empty");

            q.TryGetProperty("presetPositions", out var pp).ShouldBeTrue(
                $"Question '{id}' must have 'presetPositions'");
            pp.ValueKind.ShouldBe(JsonValueKind.Array,
                $"Question '{id}' presetPositions must be an array");

            q.TryGetProperty("hints", out var hints).ShouldBeTrue(
                $"Question '{id}' must have 'hints'");
            hints.ValueKind.ShouldBe(JsonValueKind.Object,
                $"Question '{id}' hints must be an object");
        }
    }

    // ── AC: all Georgian-script fields contain only Mkhedruli (U+10D0–U+10FF) ───

    [Test]
    public void QuestionsJson_GeorgianFields_ContainOnlyMkhedruli()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsJsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

            foreach (var field in new[] { "correctOrder", "chipPool" })
            {
                if (!q.TryGetProperty(field, out var arr) || arr.ValueKind != JsonValueKind.Array)
                    continue;

                foreach (var token in arr.EnumerateArray())
                {
                    var text = token.GetString() ?? "";
                    var nonMkhedruli = text
                        .Where(c => !char.IsWhiteSpace(c) && (c < 'ა' || c > 'ჿ'))
                        .Select(c => $"U+{(int)c:X4} '{c}'")
                        .ToList();

                    if (nonMkhedruli.Count > 0)
                        violations.Add(
                            $"Question '{id}' field '{field}' token '{text}': " +
                            $"non-Mkhedruli: {string.Join(", ", nonMkhedruli)}");
                }
            }
        }

        violations.ShouldBeEmpty(
            $"All tokens in correctOrder and chipPool must use only Mkhedruli " +
            $"(U+10D0–U+10FF). Violations:\n{string.Join("\n", violations)}");
    }

    // ── AC: every token in correctOrder appears in chipPool ───

    [Test]
    public void QuestionsJson_EveryCorrectOrderToken_PresentInChipPool()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsJsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array)
                continue;
            if (!q.TryGetProperty("chipPool", out var cp) || cp.ValueKind != JsonValueKind.Array)
                continue;

            var pool = cp.EnumerateArray()
                .Select(t => t.GetString() ?? "")
                .ToHashSet(StringComparer.Ordinal);

            foreach (var token in co.EnumerateArray())
            {
                var text = token.GetString() ?? "";
                if (!pool.Contains(text))
                    violations.Add($"Question '{id}': correctOrder token '{text}' missing from chipPool");
            }
        }

        violations.ShouldBeEmpty(
            $"Every token in correctOrder must appear in chipPool. Violations:\n" +
            string.Join("\n", violations));
    }

    // ── AC: prerequisite theory note precedes SentenceBuilder questions ───

    [Test]
    public void PostpositionsModule_TheoryNote_PrecedesSentenceBuilderQuestions()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var postpositions = catalog.Modules.FirstOrDefault(m => m.Id == "postpositions");
        postpositions.ShouldNotBeNull("Postpositions module must exist in catalog");

        var lesson7 = postpositions!.Lessons.FirstOrDefault(l => l.Id == 7);
        lesson7.ShouldNotBeNull("Postpositions module must have lesson 7 for sentence-builder");

        // Collect all text from lesson 7's theory blocks
        var theoryText = string.Join(" ",
            lesson7!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        theoryText.Contains("-ში").ShouldBeTrue(
            "Lesson 7 theory must contain the prerequisite note '-ში'");
        theoryText.Contains("-ზე").ShouldBeTrue(
            "Lesson 7 theory must contain the prerequisite note '-ზე'");
        theoryText.Contains("-თან").ShouldBeTrue(
            "Lesson 7 theory must contain the prerequisite note '-თAN'");

        // questions7.json must exist and contain sentence-builder questions
        File.Exists(QuestionsJsonPath).ShouldBeTrue(
            "questions7.json must exist for lesson 7");

        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsJsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue();

        var hasSb = questions.EnumerateArray()
            .Any(q => q.TryGetProperty("questionType", out var qt)
                      && qt.GetString() == "sentence-builder");
        hasSb.ShouldBeTrue(
            "questions7.json must contain at least one sentence-builder question");
    }

    // ── AC: design-specs/68-letter-reveal-system.md contains შ, ზ, თ for Postpositions ───

    [Test]
    public void LetterRevealMap_PostpositionsModule_ContainsShini_Zani_Tani()
    {
        File.Exists(LetterRevealSpecPath).ShouldBeTrue(
            "design-specs/68-letter-reveal-system.md must exist");

        var text = File.ReadAllText(LetterRevealSpecPath);

        var postpositionsLines = string.Join("\n",
            text.Split('\n')
                .Where(l => l.Contains("postpositions", StringComparison.OrdinalIgnoreCase)));

        postpositionsLines.ShouldNotBeNullOrEmpty(
            "68-letter-reveal-system.md must contain rows for the postpositions module");

        postpositionsLines.Contains("შ").ShouldBeTrue(
            "LESSON_REVEAL_MAP for postpositions must include შ (shini, marks -ში)");
        postpositionsLines.Contains("ზ").ShouldBeTrue(
            "LESSON_REVEAL_MAP for postpositions must include ზ (zani, marks -ზе)");
        postpositionsLines.Contains("თ").ShouldBeTrue(
            "LESSON_REVEAL_MAP for postpositions must include თ (tani, marks -თAN)");
    }

    // ── AC: all hint text values are ≤36 chars ───

    [Test]
    public void QuestionsJson_AllHints_WithinMaxLength36Chars()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsJsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            if (!q.TryGetProperty("hints", out var hints) || hints.ValueKind != JsonValueKind.Object)
                continue;

            foreach (var hint in hints.EnumerateObject())
            {
                var hintText = hint.Value.GetString() ?? "";
                if (hintText.Length > 36)
                    violations.Add(
                        $"Question '{id}', hints['{hint.Name}']: " +
                        $"{hintText.Length} chars > 36: \"{hintText}\"");
            }
        }

        violations.ShouldBeEmpty(
            "All hint texts must be ≤36 chars to fit T6 at 375px. Violations:\n" +
            string.Join("\n", violations));
    }

    // ── New-module parameterised validation (§80: 5 sentence-builder modules) ─────────────
    //
    // These tests act as pre-flight checks for tasks #876–#880.
    // Each test will fail with a clear "File not found: …" message until the corresponding
    // content JSON is created by those tasks. That is intentional — the tests are meant to
    // guide content authors, not to be silently skipped.
    //
    // All 6 checks (AC a–f from issue #881) are run in one parameterised method per module
    // via the shared helper AssertSentenceBuilderModuleJson below.

    [TestCase("GeorgianCases",        "questions10.json", TestName = "cases/questions10.json")]
    [TestCase("GeorgianPresentTense", "questions7.json",  TestName = "present-tense/questions7.json")]
    [TestCase("GeorgianVocabCafe",    "questions7.json",  TestName = "cafe/questions7.json")]
    [TestCase("GeorgianVocabShopping","questions7.json",  TestName = "shopping/questions7.json")]
    [TestCase("GeorgianVocabTaxi",    "questions7.json",  TestName = "taxi/questions7.json")]
    public void NewModule_AllSixChecks(string subdirectory, string fileName)
    {
        AssertSentenceBuilderModuleJson(subdirectory, fileName);
    }

    // ── AC: missing file fails with actionable message naming the path ────────────────────

    [Test]
    public void NewModule_MissingJsonFile_FailsWithClearMessage()
    {
        var ex = Assert.Catch<Exception>(
            () => AssertSentenceBuilderModuleJson("FakeModule", "questions99.json"));

        ex.ShouldNotBeNull("validation must throw when the content file does not exist");
        ex!.Message.ShouldContain("FakeModule/questions99.json");
    }

    // ── Shared validation helper used by all NewModule_AllSixChecks cases ─────────────────

    private static void AssertSentenceBuilderModuleJson(string subdirectory, string fileName)
    {
        var path = Path.Combine(RepoRoot, "src", "Trale", "Lessons", subdirectory, fileName);

        // (a) file exists — first check so the failure message names the missing file
        File.Exists(path).ShouldBeTrue(
            $"File not found: src/Trale/Lessons/{subdirectory}/{fileName}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            $"{subdirectory}/{fileName}: JSON must have a top-level 'questions' array");

        // (b) question count 3–15
        var count = questions.GetArrayLength();
        count.ShouldBeInRange(3, 15,
            $"{subdirectory}/{fileName}: must contain 3–15 sentence-builder questions, found {count}");

        var violations = new List<string>();

        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

            // (c) questionType must be "sentence-builder"
            q.TryGetProperty("questionType", out var qt).ShouldBeTrue(
                $"Question '{id}' must have 'questionType'");
            qt.GetString().ShouldBe("sentence-builder",
                $"Question '{id}' questionType must be 'sentence-builder'");

            var hasCorrectOrder = q.TryGetProperty("correctOrder", out var co)
                                  && co.ValueKind == JsonValueKind.Array;
            var hasChipPool = q.TryGetProperty("chipPool", out var cp)
                              && cp.ValueKind == JsonValueKind.Array;

            if (hasCorrectOrder && hasChipPool)
            {
                // (d) every correctOrder token must appear in chipPool
                var pool = cp.EnumerateArray()
                    .Select(t => t.GetString() ?? "")
                    .ToHashSet(StringComparer.Ordinal);

                foreach (var token in co.EnumerateArray())
                {
                    var text = token.GetString() ?? "";
                    if (!pool.Contains(text))
                        violations.Add(
                            $"Question '{id}': correctOrder token '{text}' missing from chipPool");
                }
            }

            // (e) Georgian-script fields contain only Mkhedruli (U+10D0–U+10FF)
            foreach (var field in new[] { "correctOrder", "chipPool" })
            {
                if (!q.TryGetProperty(field, out var arr) || arr.ValueKind != JsonValueKind.Array)
                    continue;

                foreach (var token in arr.EnumerateArray())
                {
                    var text = token.GetString() ?? "";
                    var nonMkhedruli = text
                        .Where(c => !char.IsWhiteSpace(c) && (c < 'ა' || c > 'ჿ'))
                        .Select(c => $"U+{(int)c:X4} '{c}'")
                        .ToList();

                    if (nonMkhedruli.Count > 0)
                        violations.Add(
                            $"Question '{id}' field '{field}' token '{text}': " +
                            $"non-Mkhedruli: {string.Join(", ", nonMkhedruli)}");
                }
            }

            // (f) all hint texts ≤ 36 chars
            if (q.TryGetProperty("hints", out var hints) && hints.ValueKind == JsonValueKind.Object)
            {
                foreach (var hint in hints.EnumerateObject())
                {
                    var hintText = hint.Value.GetString() ?? "";
                    if (hintText.Length > 36)
                        violations.Add(
                            $"Question '{id}', hints['{hint.Name}']: " +
                            $"{hintText.Length} chars > 36: \"{hintText}\"");
                }
            }
        }

        violations.ShouldBeEmpty(
            $"Validation violations in {subdirectory}/{fileName}:\n" +
            string.Join("\n", violations));
    }
}
