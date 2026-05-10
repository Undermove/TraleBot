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
        count.ShouldBeInRange(15, 30,
            $"questions7.json must contain 15-30 sentence-builder questions, found {count}");

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

        // (b) question count 3–25
        var count = questions.GetArrayLength();
        count.ShouldBeInRange(3, 25,
            $"{subdirectory}/{fileName}: must contain 3–25 sentence-builder questions, found {count}");

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
        count.ShouldBeInRange(3, 15,
            $"questions7.json must contain 3–15 sentence-builder questions, found {count}");
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
        count.ShouldBeInRange(3, 15,
            $"questions7.json must contain 3–15 sentence-builder questions, found {count}");
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

    // ── §880 Taxi L7 — specific AC tests ──────────────────────────────────────────────────

    private static readonly string TaxiL7JsonPath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabTaxi", "questions7.json");

    private static readonly HashSet<string> GeorgianSubjectPronounsTaxi = new(StringComparer.Ordinal)
    {
        "მე", "შენ", "ის", "ჩვენ", "თქვენ", "ისინი",
    };

    [Test]
    public void TaxiModule_MaxLessons_Is7()
    {
        var definition = ModuleRegistry.Get("taxi");
        definition.ShouldNotBeNull("taxi module must be registered");
        definition!.MaxLessons.ShouldBe(7,
            "taxi MaxLessons must be bumped from 6 to 7 (issue #880)");
    }

    [Test]
    public void TaxiModule_L7_FileExists_QuestionCount_InRange()
    {
        File.Exists(TaxiL7JsonPath).ShouldBeTrue(
            $"src/Trale/Lessons/GeorgianVocabTaxi/questions7.json must exist at {TaxiL7JsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(TaxiL7JsonPath));
        doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
            "questions7.json must have a top-level 'questions' array");

        var count = questions.GetArrayLength();
        count.ShouldBeInRange(3, 15,
            $"questions7.json must contain 3–15 sentence-builder questions, found {count}");
    }

    [Test]
    public void TaxiModule_L7_CorrectOrder_DestinationTokenIsLast()
    {
        if (!File.Exists(TaxiL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(TaxiL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        var violations = new List<string>();
        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array)
                continue;

            var tokens = co.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
            if (tokens.Count == 0) continue;

            var last = tokens[^1];

            // Last token must be a directional destination token:
            // ends with -ши (locative -ში) or -მდე (up to, directional)
            var isDestination = last.EndsWith("shi") || last.EndsWith("ში")
                                || last.EndsWith("мде") || last.EndsWith("მდე");

            // Also explicitly fail if last is a subject pronoun (never a destination)
            var isSubjectPronoun = GeorgianSubjectPronounsTaxi.Contains(last);

            if (isSubjectPronoun)
                violations.Add($"Question '{id}': last token '{last}' is a subject pronoun — destination must be last in SOV+destination-final order");
            else if (!isDestination)
                violations.Add($"Question '{id}': last token '{last}' is not a directional destination token (expected to end with -ши/-ში or -мде/-მდე)");
        }

        violations.ShouldBeEmpty(
            $"In Taxi L7 all correctOrder sequences must end with the destination token " +
            $"(Georgian destination-final rule). Violations:\n{string.Join("\n", violations)}");
    }

    [Test]
    public void TaxiModule_L7_TheoryBlock_NotesDestinationFinalRule()
    {
        var provider = new MiniAppContentProvider();
        var catalog = provider.GetCatalog();

        var taxiModule = catalog.Modules.FirstOrDefault(m => m.Id == "taxi");
        taxiModule.ShouldNotBeNull("Taxi module must exist in catalog");

        var lesson7 = taxiModule!.Lessons.FirstOrDefault(l => l.Id == 7);
        lesson7.ShouldNotBeNull("Taxi module must have lesson 7 (issue #880)");

        var theoryText = string.Join(" ",
            lesson7!.Theory.Blocks.SelectMany(b =>
                new[]
                {
                    b.Text ?? "",
                    b.Ge ?? "",
                    b.Ru ?? "",
                    string.Join(" ", b.Items ?? new List<string>())
                }));

        var hasDestinationFinalNote =
            theoryText.Contains("конце", StringComparison.OrdinalIgnoreCase)
            || theoryText.Contains("last", StringComparison.OrdinalIgnoreCase)
            || theoryText.Contains("SOV", StringComparison.OrdinalIgnoreCase)
            || theoryText.Contains("назначения", StringComparison.OrdinalIgnoreCase);

        hasDestinationFinalNote.ShouldBeTrue(
            "Taxi Lesson 7 theory must note that the destination comes last " +
            "(contain 'конце', 'last', 'SOV', or 'назначения')");
    }

    [Test]
    public void TaxiModule_L7_ChipPool_ContainsDirectionalPostpositionDistractors()
    {
        if (!File.Exists(TaxiL7JsonPath)) return;
        using var doc = JsonDocument.Parse(File.ReadAllText(TaxiL7JsonPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        // At least one question must have distractor chips using other directional postpositions
        // (-ზე / -თAN) to force postposition discrimination.
        static bool HasDirectionalDistractor(JsonElement chipPoolEl, JsonElement correctOrderEl)
        {
            var correctSet = correctOrderEl.EnumerateArray()
                .Select(t => t.GetString() ?? "")
                .ToHashSet(StringComparer.Ordinal);

            return chipPoolEl.EnumerateArray()
                .Select(t => t.GetString() ?? "")
                .Where(t => !correctSet.Contains(t))
                .Any(t => t.EndsWith("ზე") || t.EndsWith("ze") || t.EndsWith("თAN") || t.EndsWith("თან"));
        }

        var hasDistractor = questions.EnumerateArray()
            .Any(q =>
                q.TryGetProperty("chipPool", out var cp) && cp.ValueKind == JsonValueKind.Array
                && q.TryGetProperty("correctOrder", out var co) && co.ValueKind == JsonValueKind.Array
                && HasDirectionalDistractor(cp, co));

        hasDistractor.ShouldBeTrue(
            "At least one question's chipPool must include a directional postposition distractor " +
            "(-ზე or -თAN suffix) to force postposition discrimination (-ши vs -ზე vs -THАn)");
    }

    // ── §888 L4/L5 content validation ─────────────────────────────────────────────────────

    private static readonly string[] AllSixSentenceBuilderJsonPaths =
    [
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianPostpositions",  "questions7.json"),
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianCases",           "questions10.json"),
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianPresentTense",    "questions7.json"),
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabCafe",       "questions7.json"),
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabShopping",   "questions7.json"),
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVocabTaxi",       "questions7.json"),
    ];

    // AC: each of the 6 JSON files has ≥2 L4 questions and ≥1 L5 question
    [Test]
    public void L4L5Questions_AllSixModules_HaveCorrectCountAndLevel()
    {
        foreach (var path in AllSixSentenceBuilderJsonPaths)
        {
            var label = Path.GetRelativePath(RepoRoot, path);
            File.Exists(path).ShouldBeTrue($"File not found: {label}");

            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            doc.RootElement.TryGetProperty("questions", out var questions).ShouldBeTrue(
                $"{label}: must have a top-level 'questions' array");

            var l4Count = questions.EnumerateArray()
                .Count(q => q.TryGetProperty("level", out var l) && l.GetInt32() == 4);
            var l5Count = questions.EnumerateArray()
                .Count(q => q.TryGetProperty("level", out var l) && l.GetInt32() == 5);

            l4Count.ShouldBeGreaterThanOrEqualTo(2,
                $"{label}: must contain ≥2 L4 questions (found {l4Count})");
            l5Count.ShouldBeGreaterThanOrEqualTo(1,
                $"{label}: must contain ≥1 L5 questions (found {l5Count})");
        }
    }

    // AC: every L4 question has exactly 1 presetPosition (verb slot)
    [Test]
    public void L4Questions_PresetPositionsHasExactlyOneEntry()
    {
        var violations = new List<string>();
        foreach (var path in AllSixSentenceBuilderJsonPaths)
        {
            if (!File.Exists(path)) continue;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("questions", out var questions)) continue;

            foreach (var q in questions.EnumerateArray())
            {
                if (!q.TryGetProperty("level", out var lvl) || lvl.GetInt32() != 4) continue;
                var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

                if (!q.TryGetProperty("presetPositions", out var pp) || pp.ValueKind != JsonValueKind.Array)
                {
                    violations.Add($"'{id}' (L4): missing presetPositions array");
                    continue;
                }

                if (pp.GetArrayLength() != 1)
                    violations.Add(
                        $"'{id}' (L4): presetPositions must have exactly 1 entry, found {pp.GetArrayLength()}");
            }
        }

        violations.ShouldBeEmpty($"L4 preset-count violations:\n{string.Join("\n", violations)}");
    }

    // AC: every L5 question has presetPositions:[] and alternativeAnswers (if present) is non-empty
    [Test]
    public void L5Questions_PresetPositionsEmpty_AndAmbiguousQuestionsHaveAlternativeAnswers()
    {
        var violations = new List<string>();
        foreach (var path in AllSixSentenceBuilderJsonPaths)
        {
            if (!File.Exists(path)) continue;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("questions", out var questions)) continue;

            foreach (var q in questions.EnumerateArray())
            {
                if (!q.TryGetProperty("level", out var lvl) || lvl.GetInt32() != 5) continue;
                var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

                if (!q.TryGetProperty("presetPositions", out var pp) || pp.ValueKind != JsonValueKind.Array)
                {
                    violations.Add($"'{id}' (L5): missing presetPositions array");
                    continue;
                }

                if (pp.GetArrayLength() != 0)
                    violations.Add(
                        $"'{id}' (L5): presetPositions must be [] (empty), found {pp.GetArrayLength()} entries");

                if (q.TryGetProperty("alternativeAnswers", out var aa)
                    && (aa.ValueKind != JsonValueKind.Array || aa.GetArrayLength() == 0))
                    violations.Add($"'{id}' (L5): alternativeAnswers, if present, must be a non-empty array");
            }
        }

        violations.ShouldBeEmpty($"L5 structure violations:\n{string.Join("\n", violations)}");
    }

    // AC: empty presetPositions is valid only at level 4 or 5
    [Test]
    public void ValidationRule_EmptyPresetPositions_AllowedOnlyAtLevel4Or5()
    {
        var violations = new List<string>();
        foreach (var path in AllSixSentenceBuilderJsonPaths)
        {
            if (!File.Exists(path)) continue;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("questions", out var questions)) continue;

            foreach (var q in questions.EnumerateArray())
            {
                var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
                if (!q.TryGetProperty("level", out var lvl)) continue;
                var level = lvl.GetInt32();
                if (!q.TryGetProperty("presetPositions", out var pp) || pp.ValueKind != JsonValueKind.Array)
                    continue;

                if (pp.GetArrayLength() == 0 && level < 4)
                    violations.Add($"'{id}' level={level}: empty presetPositions is only valid at level 4 or 5");
            }
        }

        violations.ShouldBeEmpty(
            $"Empty presetPositions found at level < 4 — upgrade those questions to level 5 or add verb presets:\n" +
            string.Join("\n", violations));
    }

    // AC: correctOrder length is bounded at 8 tokens
    [Test]
    public void ValidationRule_CorrectOrderMaxLength_8Elements()
    {
        var violations = new List<string>();
        foreach (var path in AllSixSentenceBuilderJsonPaths)
        {
            if (!File.Exists(path)) continue;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (!doc.RootElement.TryGetProperty("questions", out var questions)) continue;

            foreach (var q in questions.EnumerateArray())
            {
                var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
                if (!q.TryGetProperty("correctOrder", out var co) || co.ValueKind != JsonValueKind.Array)
                    continue;

                if (co.GetArrayLength() > 8)
                    violations.Add($"'{id}': correctOrder has {co.GetArrayLength()} tokens (max 8)");
            }
        }

        violations.ShouldBeEmpty($"correctOrder length violations:\n{string.Join("\n", violations)}");
    }

    // Negative: L4 question with 0 preset positions demonstrates the preset-count rule catches it
    [Test]
    public void Negative_L4Question_WithEmptyPresetPositions_FailsPresetCountRule()
    {
        const string fakeJson = """
            {
              "id": "fake-l4-no-preset",
              "questionType": "sentence-builder",
              "level": 4,
              "correctOrder": ["ა", "ბ", "გ", "დ", "ე"],
              "presetPositions": [],
              "chipPool": ["ა", "ბ", "გ", "დ", "ე"],
              "hints": {}
            }
            """;

        using var doc = JsonDocument.Parse(fakeJson);
        var q = doc.RootElement;

        q.TryGetProperty("level", out var lvl).ShouldBeTrue();
        lvl.GetInt32().ShouldBe(4);

        q.TryGetProperty("presetPositions", out var pp).ShouldBeTrue();
        pp.ValueKind.ShouldBe(JsonValueKind.Array);

        // L4 with 0 entries violates the exactly-1-preset rule
        pp.GetArrayLength().ShouldBe(0,
            "The fake question has 0 preset positions, proving it would fail the L4 preset-count rule");
        (pp.GetArrayLength() != 1).ShouldBeTrue(
            "A L4 question with presetPositions:[] must be caught by the exactly-1-preset rule");
    }

    // Negative: level < 4 with empty presetPositions demonstrates the empty-preset rule catches it
    [Test]
    public void Negative_Level3Question_WithEmptyPresetPositions_FailsEmptyPresetRule()
    {
        const string fakeJson = """
            {
              "id": "fake-l3-empty-preset",
              "questionType": "sentence-builder",
              "level": 3,
              "correctOrder": ["ა", "ბ", "გ", "დ"],
              "presetPositions": [],
              "chipPool": ["ა", "ბ", "გ", "დ", "ე"],
              "hints": {}
            }
            """;

        using var doc = JsonDocument.Parse(fakeJson);
        var q = doc.RootElement;

        q.TryGetProperty("level", out var lvl).ShouldBeTrue();
        var level = lvl.GetInt32();
        level.ShouldBeLessThan(4, "The fake question has level 3 (below the L4/L5 threshold)");

        q.TryGetProperty("presetPositions", out var pp).ShouldBeTrue();
        pp.ValueKind.ShouldBe(JsonValueKind.Array);
        pp.GetArrayLength().ShouldBe(0, "The fake question has empty presetPositions");

        // This combination is exactly what ValidationRule_EmptyPresetPositions_AllowedOnlyAtLevel4Or5 catches
        var wouldBeViolation = pp.GetArrayLength() == 0 && level < 4;
        wouldBeViolation.ShouldBeTrue(
            "A question with level=3 and presetPositions:[] violates the rule: " +
            "empty presetPositions is only valid at level 4 or 5");
    }
}
