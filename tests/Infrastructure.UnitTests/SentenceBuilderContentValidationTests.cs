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

    // ── §876 Cases L10 — specific AC tests ───────────────────────────────────────────────

    private static readonly string CasesL10JsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianCases", "questions10.json");

    [Test]
    public void CasesModule_MaxLessons_Is10()
    {
        var definition = ModuleRegistry.Get("cases");
        definition.ShouldNotBeNull("cases module must be registered");
        definition!.MaxLessons.ShouldBe(10,
            "cases MaxLessons must be bumped from 9 to 10 (issue #876)");
    }

    [Test]
    public void CasesModule_L10_TheoryBlock_ContainsErgativeAndDativeMarkers()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var casesModule = catalog.Modules.FirstOrDefault(m => m.Id == "cases");
        casesModule.ShouldNotBeNull("Cases module must exist in catalog");

        var lesson10 = casesModule!.Lessons.FirstOrDefault(l => l.Id == 10);
        lesson10.ShouldNotBeNull("Cases module must have lesson 10 (issue #876)");

        var theoryText = string.Join(" ",
            lesson10!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        theoryText.Contains("-მა").ShouldBeTrue(
            "Lesson 10 theory must contain the ergative marker '-მა'");
        theoryText.Contains("-ს").ShouldBeTrue(
            "Lesson 10 theory must contain the dative marker '-ს'");
    }

    [Test]
    public void CasesModule_L10_FileExists_QuestionCount_ErgativeDativeDistribution()
    {
        File.Exists(CasesL10JsonPath).ShouldBeTrue(
            $"src/Trale/Lessons/GeorgianCases/questions10.json must exist at {CasesL10JsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(CasesL10JsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "questions10.json must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeGreaterThanOrEqualTo(5,
            $"questions10.json must have ≥5 questions, found {count}");

        var ergativeCount = 0;
        var dativeCount = 0;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array)
                continue;
            if (!q.TryGetProperty("chipPool", out var cp) || cp.ValueKind != JsonValueKind.Array)
                continue;

            var tokens = co.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
            var pool = cp.EnumerateArray().Select(t => t.GetString() ?? "").ToHashSet(StringComparer.Ordinal);

            // Ergative: token ending -მა (e.g. კაცმა, სტუდენტმა)
            if (tokens.Any(t => t.EndsWith("მა")))
                ergativeCount++;

            // Dative noun: token ending -ს that has a nominative counterpart in the chipPool
            // (distinguishes dative nouns from present-tense 3sg verb endings)
            if (tokens.Any(t => t.EndsWith("ს") && t.Length > 2 && HasNominativeAlternative(t, pool)))
                dativeCount++;
        }

        ergativeCount.ShouldBeGreaterThanOrEqualTo(2,
            $"≥2 questions must have an ergative marker token (-მА), found {ergativeCount}");
        dativeCount.ShouldBeGreaterThanOrEqualTo(2,
            $"≥2 questions must have a dative marker token (-ს with nominative in chipPool), found {dativeCount}");
    }

    [Test]
    public void CasesModule_L10_EveryCorrectOrderToken_PresentInChipPool()
    {
        if (!File.Exists(CasesL10JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(CasesL10JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array) continue;
            if (!q.TryGetProperty("chipPool", out var cp) || cp.ValueKind != JsonValueKind.Array) continue;

            var pool = cp.EnumerateArray().Select(t => t.GetString() ?? "").ToHashSet(StringComparer.Ordinal);
            foreach (var token in co.EnumerateArray())
            {
                var text = token.GetString() ?? "";
                if (!pool.Contains(text))
                    violations.Add($"Question '{id}': correctOrder token '{text}' missing from chipPool");
            }
        }

        violations.ShouldBeEmpty(
            $"Every correctOrder token must appear in chipPool. Violations:\n{string.Join("\n", violations)}");
    }

    [Test]
    public void CasesModule_L10_GeorgianFields_ContainOnlyMkhedruli()
    {
        if (!File.Exists(CasesL10JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(CasesL10JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            foreach (var field in new[] { "correctOrder", "chipPool" })
            {
                if (!q.TryGetProperty(field, out var arr) || arr.ValueKind != JsonValueKind.Array) continue;
                foreach (var token in arr.EnumerateArray())
                {
                    var text = token.GetString() ?? "";
                    var bad = text.Where(c => !char.IsWhiteSpace(c) && (c < 'ა' || c > 'ჿ'))
                                  .Select(c => $"U+{(int)c:X4}").ToList();
                    if (bad.Count > 0)
                        violations.Add($"Question '{id}' field '{field}' token '{text}': non-Mkhedruli {string.Join(", ", bad)}");
                }
            }
        }

        violations.ShouldBeEmpty(
            $"All tokens in correctOrder and chipPool must be Mkhedruli only. Violations:\n{string.Join("\n", violations)}");
    }

    [Test]
    public void CasesModule_L10_ChipPool_ContainsCaseSuffixDistractors()
    {
        if (!File.Exists(CasesL10JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(CasesL10JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        // At least one question must have distractor chips using other case suffixes
        // (-ი nominative, -ის genitive, -ად adverbial, -ით instrumental, -მა ergative)
        // to force case-form discrimination.
        static bool HasCaseSuffixDistractor(JsonElement chipPoolEl)
        {
            foreach (var chip in chipPoolEl.EnumerateArray())
            {
                var t = chip.GetString() ?? "";
                if (t.EndsWith("ი") || t.EndsWith("ის") || t.EndsWith("ად") || t.EndsWith("ით") || t.EndsWith("მა"))
                    return true;
            }
            return false;
        }

        var hasDistractors = questions.EnumerateArray()
            .Any(q => q.TryGetProperty("chipPool", out var cp) && cp.ValueKind == JsonValueKind.Array
                      && HasCaseSuffixDistractor(cp));

        hasDistractors.ShouldBeTrue(
            "At least one question's chipPool must include case-suffix distractor chips " +
            "(-ი, -ის, -ად, -ით, or -მა) to force case-form discrimination");
    }

    // Heuristic: a token ending -ს is likely a dative noun (not a verb) when the chipPool
    // contains the same stem with a nominative ending (-ი) or without the -ს suffix.
    private static bool HasNominativeAlternative(string datToken, HashSet<string> pool)
    {
        if (datToken.Length < 2) return false;
        var stem = datToken[..^1]; // strip trailing ს
        return pool.Contains(stem) || pool.Contains(stem + "ი");
    }

    // ── §877 PresentTense L7 — specific AC tests ─────────────────────────────────────────

    private static readonly string PresentTenseL7JsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianPresentTense", "questions7.json");

    private static readonly HashSet<string> Class1PresentTenseVerbs = new(StringComparer.Ordinal)
    {
        "ვკითხულობ", "კითხულობს", "კითხულობ",
        "ვწერ", "წერ", "წერს",
        "ვხედავ", "ხედავს", "ვხედავთ", "ხედავენ",
        "ვაკეთებ", "აკეთებს",
        "ვსვამ", "სვამს",
        "ვჭამ", "ჭამს",
        "ვლაპარაკობ", "ლაპარაკობს",
    };

    private static readonly HashSet<string> Class2PresentTenseVerbs = new(StringComparer.Ordinal)
    {
        "მიდის", "მივდივარ", "მიდიხარ", "მივდივართ",
        "სძინავს", "ვძინავ",
        "ვცხოვრობ", "ცხოვრობს",
    };

    private static readonly HashSet<string> GeorgianSubjectPronouns = new(StringComparer.Ordinal)
    {
        "მე", "შენ", "ის", "ჩვენ", "თქვენ", "ისინი",
    };

    [Test]
    public void PresentTenseModule_MaxLessons_Is7()
    {
        var definition = ModuleRegistry.Get("present-tense");
        definition.ShouldNotBeNull("present-tense module must be registered");
        definition!.MaxLessons.ShouldBe(7,
            "present-tense MaxLessons must be bumped from 6 to 7 (issue #877)");
    }

    [Test]
    public void PresentTenseModule_L7_TheoryBlock_ContainsSOVAndVerbClasses()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var module = catalog.Modules.FirstOrDefault(m => m.Id == "present-tense");
        module.ShouldNotBeNull("present-tense module must exist in catalog");

        var lesson7 = module!.Lessons.FirstOrDefault(l => l.Id == 7);
        lesson7.ShouldNotBeNull("present-tense module must have lesson 7 (issue #877)");

        var theoryText = string.Join(" ",
            lesson7!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        var hasSov = theoryText.Contains("SOV", StringComparison.OrdinalIgnoreCase)
                     || theoryText.Contains("Subject-Object-Verb", StringComparison.OrdinalIgnoreCase);
        hasSov.ShouldBeTrue(
            "Lesson 7 theory must mention 'SOV' or 'Subject-Object-Verb' explicitly");

        var hasVerbClasses = theoryText.Contains("Класс 1", StringComparison.OrdinalIgnoreCase)
                             || theoryText.Contains("Кл.1", StringComparison.OrdinalIgnoreCase)
                             || theoryText.Contains("Class 1", StringComparison.OrdinalIgnoreCase);
        hasVerbClasses.ShouldBeTrue(
            "Lesson 7 theory must mention Class 1 (transitive) verbs");

        var hasClass2 = theoryText.Contains("Класс 2", StringComparison.OrdinalIgnoreCase)
                        || theoryText.Contains("Кл.2", StringComparison.OrdinalIgnoreCase)
                        || theoryText.Contains("Class 2", StringComparison.OrdinalIgnoreCase);
        hasClass2.ShouldBeTrue(
            "Lesson 7 theory must mention Class 2 (intransitive) verbs");
    }

    [Test]
    public void PresentTenseModule_L7_FileExists_QuestionCount_ClassDistribution()
    {
        File.Exists(PresentTenseL7JsonPath).ShouldBeTrue(
            $"src/Trale/Lessons/GeorgianPresentTense/questions7.json must exist at {PresentTenseL7JsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(PresentTenseL7JsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "questions7.json must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeGreaterThanOrEqualTo(5,
            $"questions7.json must have ≥5 sentence-builder questions, found {count}");

        var class1Count = 0;
        var class2Count = 0;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array) continue;
            var tokens = co.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
            if (tokens.Count == 0) continue;

            var lastToken = tokens[^1];
            if (Class1PresentTenseVerbs.Contains(lastToken)) class1Count++;
            if (Class2PresentTenseVerbs.Contains(lastToken)) class2Count++;
        }

        class1Count.ShouldBeGreaterThanOrEqualTo(2,
            $"≥2 questions must use a Class 1 (transitive) verb as the last token in correctOrder, found {class1Count}");
        class2Count.ShouldBeGreaterThanOrEqualTo(1,
            $"≥1 question must use a Class 2 (intransitive) verb as the last token in correctOrder, found {class2Count}");
    }

    [Test]
    public void PresentTenseModule_L7_CorrectOrder_FollowsSOV()
    {
        if (!File.Exists(PresentTenseL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(PresentTenseL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array) continue;

            var tokens = co.EnumerateArray().Select(t => t.GetString() ?? "").ToList();

            if (tokens.Count < 3)
                violations.Add(
                    $"Question '{id}': correctOrder has {tokens.Count} token(s); SOV needs at least 3 (S + O/Loc + V)");

            if (tokens.Count > 0 && GeorgianSubjectPronouns.Contains(tokens[^1]))
                violations.Add(
                    $"Question '{id}': last token '{tokens[^1]}' is a subject pronoun — verb must be last in SOV order");
        }

        violations.ShouldBeEmpty(
            $"SOV order violations in PresentTense L7:\n{string.Join("\n", violations)}");
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

    // ── §878 Cafe L7 — specific AC tests ─────────────────────────────────────────

    private static readonly string CafeL7JsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabCafe", "questions7.json");

    [Test]
    public void CafeModule_MaxLessons_Is7()
    {
        var definition = ModuleRegistry.Get("cafe");
        definition.ShouldNotBeNull("cafe module must be registered");
        definition!.MaxLessons.ShouldBe(7,
            "cafe MaxLessons must be bumped from 6 to 7 (issue #878)");
    }

    [Test]
    public void CafeModule_L7_FileExists_QuestionCount_InRange()
    {
        File.Exists(CafeL7JsonPath).ShouldBeTrue(
            $"src/Trale/Lessons/GeorgianVocabCafe/questions7.json must exist at {CafeL7JsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(CafeL7JsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "questions7.json must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeInRange(3, 7,
            $"questions7.json must contain 3–7 sentence-builder questions, found {count}");
    }

    [Test]
    public void CafeModule_L7_SlotLevels_CorrectEmptySlotCounts()
    {
        if (!File.Exists(CafeL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(CafeL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

            if (!q.TryGetProperty("level", out var levelEl)) continue;
            var level = levelEl.GetInt32();

            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array) continue;
            var correctOrderLength = co.GetArrayLength();

            var presetCount = 0;
            if (q.TryGetProperty("presetPositions", out var pp) && pp.ValueKind == JsonValueKind.Array)
                presetCount = pp.GetArrayLength();

            var emptySlots = correctOrderLength - presetCount;

            if (level == 1 && emptySlots != 1)
                violations.Add($"Question '{id}' (L1): emptySlots={emptySlots}, expected exactly 1");
            else if (level == 2 && emptySlots != 2)
                violations.Add($"Question '{id}' (L2): emptySlots={emptySlots}, expected exactly 2");
            else if (level == 3 && emptySlots <= correctOrderLength / 2)
                violations.Add(
                    $"Question '{id}' (L3): emptySlots={emptySlots} must be > " +
                    $"correctOrder.Length/2={correctOrderLength / 2}");
        }

        violations.ShouldBeEmpty(
            $"Slot-level violations in GeorgianVocabCafe/questions7.json:\n" +
            string.Join("\n", violations));
    }

    [Test]
    public void CafeModule_L7_TheoryBlock_ContainsMindaExplanation()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var cafeModule = catalog.Modules.FirstOrDefault(m => m.Id == "cafe");
        cafeModule.ShouldNotBeNull("Cafe module must exist in catalog");

        var lesson7 = cafeModule!.Lessons.FirstOrDefault(l => l.Id == 7);
        lesson7.ShouldNotBeNull("Cafe module must have lesson 7 (issue #878)");

        var theoryText = string.Join(" ",
            lesson7!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        theoryText.Contains("მინდა").ShouldBeTrue(
            "Lesson 7 theory must contain 'მინდა' (I want)");

        var hasWant = theoryText.Contains("хочу", StringComparison.OrdinalIgnoreCase)
                      || theoryText.Contains("want", StringComparison.OrdinalIgnoreCase);
        hasWant.ShouldBeTrue(
            "Lesson 7 theory must contain 'хочу' or 'want' to explain მინდა");
    }

    [Test]
    public void CafeModule_L7_ChipPool_ContainsCafeVocabDistractors()
    {
        if (!File.Exists(CafeL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(CafeL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        static int CountCafeDistractors(JsonElement chipPoolEl)
        {
            var distractors = new HashSet<string>(StringComparer.Ordinal) { "ჩაი", "წყალი", "წვენი" };
            return chipPoolEl.EnumerateArray()
                .Count(chip => distractors.Contains(chip.GetString() ?? ""));
        }

        var hasEnoughDistractors = questions.EnumerateArray()
            .Any(q => q.TryGetProperty("chipPool", out var cp)
                      && cp.ValueKind == JsonValueKind.Array
                      && CountCafeDistractors(cp) >= 2);

        hasEnoughDistractors.ShouldBeTrue(
            "At least one question's chipPool must contain ≥2 cafe-vocabulary distractor tokens " +
            "(ჩაი, წყალი, or წვენი) to force lexical discrimination");
    }

    // ── §879 Shopping L7 — specific AC tests ─────────────────────────────────────────────

    private static readonly string ShoppingL7JsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabShopping", "questions7.json");

    [Test]
    public void ShoppingModule_MaxLessons_Is7()
    {
        var definition = ModuleRegistry.Get("shopping");
        definition.ShouldNotBeNull("shopping module must be registered");
        definition!.MaxLessons.ShouldBe(7,
            "shopping MaxLessons must be bumped from 6 to 7 (issue #879)");
    }

    [Test]
    public void ShoppingModule_L7_FileExists_QuestionCount_InRange()
    {
        File.Exists(ShoppingL7JsonPath).ShouldBeTrue(
            $"src/Trale/Lessons/GeorgianVocabShopping/questions7.json must exist at {ShoppingL7JsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(ShoppingL7JsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "questions7.json must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeInRange(3, 7,
            $"questions7.json must contain 3–7 sentence-builder questions, found {count}");
    }

    [Test]
    public void ShoppingModule_L7_CorrectOrder_ContainsInterrogativeParticle()
    {
        if (!File.Exists(ShoppingL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(ShoppingL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        static bool HasInterrogativeParticle(JsonElement correctOrder)
        {
            var tokens = correctOrder.EnumerateArray()
                .Select(t => t.GetString() ?? "")
                .ToList();
            if (tokens.Any(t => t.Contains("რა") && t.Contains("ღირს")))
                return true;
            return tokens.Contains("რა") && tokens.Contains("ღირს");
        }

        var hasInterrogative = questions.EnumerateArray()
            .Any(q => q.TryGetProperty("correctOrder", out var co)
                      && co.ValueKind == JsonValueKind.Array
                      && HasInterrogativeParticle(co));

        hasInterrogative.ShouldBeTrue(
            "At least one question's correctOrder must contain 'რა ღირს' " +
            "(as one token or separate 'რა' and 'ღირს' tokens)");

        var hasDemonstrative = questions.EnumerateArray()
            .Any(q => q.TryGetProperty("correctOrder", out var co)
                      && co.ValueKind == JsonValueKind.Array
                      && co.EnumerateArray().Any(t => t.GetString() == "ეს"));

        hasDemonstrative.ShouldBeTrue(
            "At least one question's correctOrder must contain the demonstrative 'ეს'");
    }

    [Test]
    public void ShoppingModule_L7_TheoryBlock_ExplainsInterrogativeConstruction()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var shoppingModule = catalog.Modules.FirstOrDefault(m => m.Id == "shopping");
        shoppingModule.ShouldNotBeNull("Shopping module must exist in catalog");

        var lesson7 = shoppingModule!.Lessons.FirstOrDefault(l => l.Id == 7);
        lesson7.ShouldNotBeNull("Shopping module must have lesson 7 (issue #879)");

        var theoryText = string.Join(" ",
            lesson7!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        var hasInterrogative = theoryText.Contains("რა ღირს")
                               || theoryText.Contains("question", StringComparison.OrdinalIgnoreCase)
                               || theoryText.Contains("вопрос", StringComparison.OrdinalIgnoreCase);
        hasInterrogative.ShouldBeTrue(
            "Lesson 7 theory must explain 'რა ღირს' or mention 'question'/'вопрос'");
    }

    [Test]
    public void ShoppingModule_L7_ChipPool_ContainsShoppingDistractors()
    {
        if (!File.Exists(ShoppingL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(ShoppingL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        static int CountDistractors(JsonElement chipPoolEl, JsonElement correctOrderEl)
        {
            var correctSet = correctOrderEl.EnumerateArray()
                .Select(t => t.GetString() ?? "")
                .ToHashSet(StringComparer.Ordinal);
            return chipPoolEl.EnumerateArray()
                .Count(chip => !correctSet.Contains(chip.GetString() ?? ""));
        }

        var hasEnoughDistractors = questions.EnumerateArray()
            .Any(q =>
                q.TryGetProperty("chipPool", out var cp) && cp.ValueKind == JsonValueKind.Array
                && q.TryGetProperty("correctOrder", out var co) && co.ValueKind == JsonValueKind.Array
                && CountDistractors(cp, co) >= 2);

        hasEnoughDistractors.ShouldBeTrue(
            "At least one question's chipPool must contain ≥2 distractor tokens " +
            "beyond correctOrder (price-related or shopping-vocabulary tokens)");
    }
}
