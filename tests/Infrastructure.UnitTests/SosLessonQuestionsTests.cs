using System.Text.Json;
using Shouldly;

namespace Infrastructure.UnitTests;

/// <summary>
/// Validates the structural integrity of questions6.json for the SOS lesson
/// (Урок 6 «Экстренные фразы» in module «Знакомство»).
/// </summary>
public class SosLessonQuestionsTests
{
    private JsonElement _root;
    private JsonElement[] _questions = [];

    private static readonly string[] ExpectedPhrases =
    [
        "დამეხმარეთ",
        "პოლიცია",
        "სასწრაფო",
        "არ მესმის",
        "სად ვარ"
    ];

    [SetUp]
    public void SetUp()
    {
        var path = FindQuestionsFile();
        path.ShouldNotBeNull("questions6.json for GeorgianVocabIntro not found");

        var json = File.ReadAllText(path!);
        var doc = JsonDocument.Parse(json);
        _root = doc.RootElement;
        _questions = _root.GetProperty("questions").EnumerateArray().ToArray();
    }

    [Test]
    public void ShouldHaveLessonId_IntroSix()
    {
        _root.GetProperty("lesson_id").GetString().ShouldBe("intro-6");
    }

    [Test]
    public void ShouldHaveExactly12Questions()
    {
        _questions.Length.ShouldBe(12);
    }

    [Test]
    public void AllQuestions_ShouldHaveRequiredFields()
    {
        foreach (var q in _questions)
        {
            q.TryGetProperty("id", out _).ShouldBeTrue($"Question missing 'id'");
            q.TryGetProperty("lemma", out _).ShouldBeTrue($"Question missing 'lemma'");
            q.TryGetProperty("question", out _).ShouldBeTrue($"Question missing 'question'");
            q.TryGetProperty("options", out _).ShouldBeTrue($"Question missing 'options'");
            q.TryGetProperty("answer_index", out _).ShouldBeTrue($"Question missing 'answer_index'");
        }
    }

    [Test]
    public void AllQuestions_ShouldHaveExactly3Options()
    {
        foreach (var q in _questions)
        {
            var options = q.GetProperty("options").EnumerateArray().ToArray();
            options.Length.ShouldBe(3, $"Question {q.GetProperty("id").GetString()} should have 3 options");
        }
    }

    [Test]
    public void AllQuestions_AnswerIndexShouldBeInRange()
    {
        foreach (var q in _questions)
        {
            var answerIndex = q.GetProperty("answer_index").GetInt32();
            answerIndex.ShouldBeInRange(0, 2,
                $"answer_index out of range for question {q.GetProperty("id").GetString()}");
        }
    }

    [Test]
    public void AllFiveSosPhrases_ShouldAppearAsLemmas()
    {
        var lemmas = _questions
            .Select(q => q.GetProperty("lemma").GetString() ?? string.Empty)
            .ToHashSet();

        foreach (var phrase in ExpectedPhrases)
        {
            lemmas.ShouldContain(phrase, $"SOS phrase '{phrase}' not found in question lemmas");
        }
    }

    [Test]
    public void QuestionIds_ShouldBeUnique()
    {
        var ids = _questions
            .Select(q => q.GetProperty("id").GetString())
            .ToList();

        ids.Distinct().Count().ShouldBe(ids.Count, "Question IDs should be unique");
    }

    [Test]
    public void QuestionIds_ShouldFollowIntro6Prefix()
    {
        foreach (var q in _questions)
        {
            var id = q.GetProperty("id").GetString() ?? string.Empty;
            id.ShouldStartWith("intro6-", $"Question ID '{id}' should start with 'intro6-'");
        }
    }

    private static string? FindQuestionsFile()
    {
        var fileName = "questions6.json";
        var subdir = Path.Combine("Lessons", "GeorgianVocabIntro");

        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, subdir, fileName),
            // Walk up from test binary to repo root
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "Trale", subdir, fileName),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "src", "Trale", subdir, fileName),
        };

        return candidates.Select(Path.GetFullPath).FirstOrDefault(File.Exists);
    }
}
