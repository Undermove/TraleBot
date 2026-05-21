using System.Text.Json;
using NUnit.Framework;
using Shouldly;

namespace Domain.UnitTests.Content;

/// <summary>
/// Verifies that src/Trale/Lessons/GeorgianVerbalAspect/questions.json
/// satisfies the content requirements for the verbal-aspect module.
/// Tests deserialise the JSON directly — no DB or DI needed.
/// </summary>
public class VerbalAspectQuestionsLoaderTests
{
    private static readonly string RepoRoot = FindRepoRoot();
    private static readonly string QuestionsFilePath =
        Path.Combine(RepoRoot, "src", "Trale", "Lessons", "GeorgianVerbalAspect", "questions.json");

    private static JsonElement[] _questions = null!;

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
        throw new InvalidOperationException("Could not locate the repo root (directory containing FEATURES.md and .git).");
    }

    [OneTimeSetUp]
    public void LoadJson()
    {
        File.Exists(QuestionsFilePath).ShouldBeTrue(
            $"questions.json not found at expected path: {QuestionsFilePath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(QuestionsFilePath));
        doc.RootElement.TryGetProperty("questions", out var arr).ShouldBeTrue(
            "JSON must have a 'questions' array");

        _questions = arr.EnumerateArray().Select(q => q.Clone()).ToArray();
    }

    // ── AC 1: exactly 6 multiple-choice questions ──────────────────────────────

    [Test]
    public void VerbalAspect_QuestionsJson_Contains_Exactly6MultipleChoiceQuestions()
    {
        _questions.Length.ShouldBe(6, "questions.json must contain exactly 6 questions");

        foreach (var q in _questions)
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var hasType = (q.TryGetProperty("question_type", out var qt)
                          || q.TryGetProperty("questionType", out qt))
                          && qt.GetString() == "multiple-choice";
            hasType.ShouldBeTrue($"Question '{id}' must have question_type = 'multiple-choice'");
        }
    }

    // ── AC 2: recognition questions correct answers match table cells ──────────

    [Test]
    public void RecognitionQuestions_CorrectAnswers_MatchTableCells()
    {
        var recognition = _questions
            .Where(q => HasTag(q, "recognition"))
            .ToArray();

        recognition.Length.ShouldBe(2, "There must be exactly 2 recognition questions (tagged 'recognition')");

        // Imperfect recognition → correct answer is ვწერდი
        var imperfectQ = recognition.FirstOrDefault(q => HasTag(q, "imperfect"));
        imperfectQ.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "One recognition question must be tagged 'imperfect'");
        var imperfectAnswer = GetCorrectAnswer(imperfectQ);
        Assert.That(imperfectAnswer, Does.Contain("ვწერდი"),
            "Imperfect recognition correct answer must be ვწერდი (Imperfect = несов. прошл.)");

        // Aorist recognition → correct answer is დავწერე
        var aoristQ = recognition.FirstOrDefault(q => HasTag(q, "aorist"));
        aoristQ.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "One recognition question must be tagged 'aorist'");
        var aoristAnswer = GetCorrectAnswer(aoristQ);
        Assert.That(aoristAnswer, Does.Contain("დავწერე"),
            "Aorist recognition correct answer must be დავწერე (Aorist = сов. прошл.)");
    }

    // ── AC 3: context questions feedback has explicit aspect reference ──────────

    [Test]
    public void ContextQuestions_Feedback_ContainsAspectCategoryReference()
    {
        var context = _questions
            .Where(q => HasTag(q, "context"))
            .ToArray();

        context.Length.ShouldBe(2, "There must be exactly 2 context questions (tagged 'context')");

        var imperfectCtx = context.FirstOrDefault(q => HasTag(q, "imperfect"));
        imperfectCtx.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "One context question must be tagged 'imperfect'");
        Assert.That(GetExplanation(imperfectCtx), Does.Contain("несовершенный вид"),
            "Imperfect context question feedback must contain 'несовершенный вид'");

        var aoristCtx = context.FirstOrDefault(q => HasTag(q, "aorist"));
        aoristCtx.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "One context question must be tagged 'aorist'");
        Assert.That(GetExplanation(aoristCtx), Does.Contain("совершенный вид"),
            "Aorist context question feedback must contain 'совершенный вид'");
    }

    // ── AC 4: habitual/once questions correct answers and feedback markers ──────

    [Test]
    public void HabitualOnceQuestions_CorrectAnswers_MatchAspectRule_And_FeedbackContainsMarkers()
    {
        var habitual = _questions.FirstOrDefault(q => HasTag(q, "habitual"));
        habitual.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "There must be at least one question tagged 'habitual'");
        Assert.That(GetCorrectAnswer(habitual), Does.Contain("ვწერდი"),
            "Habitual question must have ვწერდი (Imperfect) as correct answer");
        Assert.That(GetExplanation(habitual), Does.Contain("ყოველ დღეს"),
            "Habitual question feedback must contain 'ყოველ დღეს'");
        Assert.That(GetExplanation(habitual), Does.Contain("несовершенный вид"),
            "Habitual question feedback must contain 'несовершенный вид'");

        var once = _questions.FirstOrDefault(q => HasTag(q, "once"));
        once.ValueKind.ShouldNotBe(JsonValueKind.Undefined,
            "There must be at least one question tagged 'once'");
        Assert.That(GetCorrectAnswer(once), Does.Contain("დავწერე"),
            "Once question must have დავწერე (Aorist) as correct answer");
        Assert.That(GetExplanation(once), Does.Contain("однократное"),
            "Once question feedback must contain 'однократное'");
        Assert.That(GetExplanation(once), Does.Contain("совершенный вид"),
            "Once question feedback must contain 'совершенный вид'");
    }

    // ── AC (negative): distractors are verb forms of the same verb ─────────────

    [Test]
    public void AllDistractors_AreVerbFormsOfSameVerb_NotCrossSemanticWords()
    {
        // All options must be conjugated forms of "писать" (წერა).
        // Every option must contain the Georgian root "წერ".
        foreach (var q in _questions)
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            if (!q.TryGetProperty("options", out var opts)
                || opts.ValueKind != JsonValueKind.Array) continue;

            foreach (var opt in opts.EnumerateArray())
            {
                var optStr = opt.GetString() ?? string.Empty;
                Assert.That(optStr, Does.Contain("წერ"),
                    $"Question '{id}': option '{optStr}' must be a form of the verb 'писать' (root 'წერ'). " +
                    "Distractors must not use cross-semantic vocabulary.");
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static bool HasTag(JsonElement q, string tag)
    {
        if (!q.TryGetProperty("tags", out var tags) || tags.ValueKind != JsonValueKind.Array)
            return false;
        return tags.EnumerateArray().Any(t => t.GetString() == tag);
    }

    private static string GetCorrectAnswer(JsonElement q)
    {
        q.TryGetProperty("options", out var opts);
        q.TryGetProperty("answer_index", out var ai);
        var idx = ai.GetInt32();
        var options = opts.EnumerateArray().Select(o => o.GetString() ?? string.Empty).ToArray();
        return idx < options.Length ? options[idx] : string.Empty;
    }

    private static string GetExplanation(JsonElement q)
    {
        return q.TryGetProperty("explanation", out var ex) ? ex.GetString() ?? string.Empty : string.Empty;
    }
}
