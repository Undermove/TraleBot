using System.Text.Json;
using System.Text.RegularExpressions;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests;

// The alphabet module teaches letters one by one: a new letter first shows up inside
// Russian words («ბაнაн» — банан), and real Georgian words come once all their letters
// are learned. These checks keep it that way:
// - every Georgian letter in lesson N (theory and questions, mixed words included) was
//   introduced in lessons 1..N, so the learner can always read what is on screen;
// - questions are served in the authored order, and a question never uses a letter of its
//   own lesson before the "new-letter" question that introduces it;
// - a question that mixes Cyrillic and Georgian inside one word is tagged "mixed-script";
// - a meaning is shown (theory or an earlier question) before a question asks for it;
// - no linguistics jargon and no Latin transliteration — pronunciation is given
//   in Cyrillic and explained in plain words;
// - lessons stay short (10–12 questions, a 2–3 minute session);
// - no audio of isolated letter names (the TTS cannot tell similar letters apart).
public class AlphabetProgressiveReadabilityTests
{
    private const string ModuleId = "alphabet-progressive";

    private static readonly Regex Jargon = new(
        "абруптив|эжектив|придыха|придых\\.|звонк|глух|аффрикат|гортан|увуляр|смычн|фрикатив",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Latin = new("[A-Za-z]", RegexOptions.Compiled);

    private static readonly ModuleDto Module = new MiniAppContentProvider().GetCatalog()
        .Modules.Single(m => m.Id == ModuleId);

    private static IEnumerable<int> LessonIds() => Enumerable.Range(1, ModuleRegistry.Get(ModuleId)!.MaxLessons);

    [Test]
    public void Catalog_and_registry_agree_on_lesson_count()
    {
        Module.Lessons.Select(l => l.Id).ShouldBe(LessonIds());
    }

    [TestCaseSource(nameof(LessonIds))]
    public void Every_georgian_word_uses_only_letters_learned_so_far(int lessonId)
    {
        var known = KnownLetters(lessonId);
        var failures = new List<string>();

        foreach (var (where, text) in TheoryTexts(lessonId).Concat(QuestionTexts(lessonId)))
        {
            foreach (Match word in Regex.Matches(text, "[ა-ჿ]+"))
            {
                var unknown = word.Value.Where(c => !known.Contains(c)).Distinct().ToArray();
                if (unknown.Length > 0)
                    failures.Add($"{where}: «{word.Value}» uses {string.Join(", ", unknown)} not learned by lesson {lessonId}");
            }
        }

        failures.ShouldBeEmpty(string.Join("\n", failures));
    }

    [TestCaseSource(nameof(LessonIds))]
    public void Questions_follow_the_order_letters_are_introduced(int lessonId)
    {
        var raw = LoadLessonRoot(lessonId);
        raw.TryGetProperty("ordered", out var ordered).ShouldBeTrue($"lesson {lessonId} must set \"ordered\": true");
        ordered.ValueKind.ShouldBe(JsonValueKind.True);

        var known = KnownLetters(lessonId - 1);
        var introduced = LoadQuestions(lessonId)
            .Where(q => q.GetProperty("tags").EnumerateArray().Any(t => t.GetString() == "new-letter"))
            .Select(q => q.GetProperty("lemma").GetString()!.Single())
            .ToHashSet();
        introduced.ShouldBe(KnownLetters(lessonId).Except(known).ToHashSet(), ignoreOrder: true,
            $"lesson {lessonId}: every letter of its Letters(...) block gets exactly one \"new-letter\" question");
        var failures = new List<string>();
        foreach (var q in LoadQuestions(lessonId))
        {
            var id = q.GetProperty("id").GetString();
            var tags = q.GetProperty("tags").EnumerateArray().Select(t => t.GetString()).ToList();
            if (tags.Contains("new-letter")) known.Add(q.GetProperty("lemma").GetString()!.Single());

            foreach (var (_, text) in QuestionTexts(q, lessonId))
            {
                foreach (Match word in Regex.Matches(text, "[\u0400-\u04FF\u10D0-\u10FF]+"))
                {
                    var unknown = word.Value.Where(c => c is >= '\u10D0' and <= '\u10FF' && !known.Contains(c)).Distinct().ToArray();
                    if (unknown.Length > 0)
                        failures.Add($"question {id}: «{word.Value}» uses {string.Join(", ", unknown)} before it is introduced");

                    var isMixed = word.Value.Any(c => c is >= '\u10D0' and <= '\u10FF') && word.Value.Any(c => c is >= '\u0400' and <= '\u04FF');
                    if (isMixed && !tags.Contains("mixed-script"))
                        failures.Add($"question {id}: «{word.Value}» mixes scripts but the question is not tagged mixed-script");
                }
            }
        }

        failures.ShouldBeEmpty(string.Join("\n", failures));
    }

    // A question must never ask what the learner has not been shown. The meaning a
    // "meaning" / "word-recognition" question asks about must appear next to the Georgian
    // word in the text or explanation of an earlier question of this or a previous lesson
    // (an explanation is seen only after answering, so it counts for later questions only).
    // The theory screen does not count: the lesson-1 theory listed «და — и», and the owner
    // still met «Что значит და?» unprepared — people skim the theory before practice.
    [TestCaseSource(nameof(LessonIds))]
    public void Meanings_are_shown_before_they_are_asked(int lessonId)
    {
        var shown = new List<string>();
        for (var earlier = 1; earlier < lessonId; earlier++)
            shown.AddRange(LoadQuestions(earlier).SelectMany(ShownText));

        var failures = new List<string>();
        foreach (var q in LoadQuestions(lessonId))
        {
            var tags = q.GetProperty("tags").EnumerateArray().Select(t => t.GetString()).ToList();
            var options = q.GetProperty("options").EnumerateArray().Select(o => o.GetString()!).ToList();
            var correct = options[q.GetProperty("answer_index").GetInt32()];
            string? word = null, meaning = null;
            if (tags.Contains("meaning"))
            {
                word = q.GetProperty("lemma").GetString();
                meaning = correct;
            }
            else if (tags.Contains("word-recognition"))
            {
                word = correct;
                var m = Regex.Match(q.GetProperty("question").GetString()!, "«([^»]+)»");
                meaning = m.Success ? m.Groups[1].Value : null;
            }

            // A teaching question may give the knowledge in its own text and check it below
            // («და» значит «и». …?): its own question text counts, its explanation does not.
            var ownText = q.GetProperty("question").GetString()!;
            if (word != null && meaning != null && !shown.Append(ownText).Any(t => ShownTogether(t, word, meaning)))
                failures.Add($"question {q.GetProperty("id").GetString()}: asks «{word}» = «{meaning}», but that was never shown before");

            shown.AddRange(ShownText(q));
        }

        failures.ShouldBeEmpty(string.Join("\n", failures));
    }

    private static IEnumerable<string> ShownText(JsonElement q)
    {
        foreach (var field in new[] { "question", "explanation" })
            if (q.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String)
                yield return v.GetString()!;
    }

    private static bool ShownTogether(string text, string word, string meaning)
    {
        // Whole words only: the meaning «и» must not be found inside «значит».
        var words = Regex.Matches(text, $@"(?<!\p{{L}}){Regex.Escape(word)}(?!\p{{L}})").Select(m => m.Index).ToList();
        var meanings = Regex.Matches(text, $@"(?<!\p{{L}}){Regex.Escape(meaning)}(?!\p{{L}})").Select(m => m.Index).ToList();
        return words.Any(w => meanings.Any(m => Math.Abs(m - w) <= 60));
    }

    [TestCaseSource(nameof(LessonIds))]
    public void Texts_have_no_jargon_and_no_latin(int lessonId)
    {
        var failures = new List<string>();
        foreach (var (where, text) in TheoryTexts(lessonId).Concat(QuestionTexts(lessonId)))
        {
            if (Jargon.IsMatch(text)) failures.Add($"{where}: jargon in «{text}»");
            if (Latin.IsMatch(text)) failures.Add($"{where}: Latin letters in «{text}»");
        }

        failures.ShouldBeEmpty(string.Join("\n", failures));
    }

    [TestCaseSource(nameof(LessonIds))]
    public void Lesson_is_short_and_options_are_distinct(int lessonId)
    {
        var questions = LoadQuestions(lessonId);
        questions.Count.ShouldBeInRange(10, 12, $"lesson {lessonId} should be a 2–3 minute session");

        foreach (var q in questions)
        {
            var options = q.GetProperty("options").EnumerateArray().Select(o => o.GetString()).ToList();
            options.Distinct().Count().ShouldBe(options.Count, $"question {q.GetProperty("id")} has duplicate options");
        }
    }

    [TestCaseSource(nameof(LessonIds))]
    public void No_isolated_letter_audio(int lessonId)
    {
        foreach (var q in LoadQuestions(lessonId))
        {
            if (!q.TryGetProperty("audio_url", out var url)) continue;
            url.GetString()!.ShouldNotStartWith("/audio/alphabet/",
                customMessage: $"question {q.GetProperty("id")}: letter-name audio is too unclear to tell similar letters apart");
        }
    }

    private static HashSet<char> KnownLetters(int lessonId) =>
        Module.Lessons
            .Where(l => l.Id <= lessonId)
            .SelectMany(l => l.Theory.Blocks)
            .Where(b => b.Type == "letters")
            .SelectMany(b => b.Letters)
            .Select(l => l.Letter.Single())
            .ToHashSet();

    private static IEnumerable<(string Where, string Text)> TheoryTexts(int lessonId)
    {
        var lesson = Module.Lessons.Single(l => l.Id == lessonId);
        var where = $"lesson {lessonId} theory";
        yield return (where, lesson.Title);
        yield return (where, lesson.Short);
        yield return (where, lesson.Theory.Title);
        yield return (where, lesson.Theory.Goal);
        foreach (var block in lesson.Theory.Blocks)
        {
            if (block.Text != null) yield return (where, block.Text);
            foreach (var item in block.Items ?? new List<string>()) yield return (where, item);
            if (block.Ge != null) yield return (where, block.Ge);
            if (block.Ru != null) yield return (where, block.Ru);
            foreach (var letter in block.Letters ?? new List<AlphabetLetterDto>())
            {
                yield return (where, letter.Translit);
                yield return (where, letter.ExampleGe);
                yield return (where, letter.ExampleRu);
            }
        }
    }

    private static IEnumerable<(string Where, string Text)> QuestionTexts(int lessonId) =>
        LoadQuestions(lessonId).SelectMany(q => QuestionTexts(q, lessonId));

    private static IEnumerable<(string Where, string Text)> QuestionTexts(JsonElement q, int lessonId)
    {
        var where = $"lesson {lessonId} question {q.GetProperty("id").GetString()}";
        foreach (var field in new[] { "lemma", "question", "explanation", "transcript" })
        {
            if (q.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String)
                yield return (where, v.GetString()!);
        }
        foreach (var option in q.GetProperty("options").EnumerateArray())
            yield return (where, option.GetString()!);
    }

    private static List<JsonElement> LoadQuestions(int lessonId) =>
        LoadLessonRoot(lessonId).GetProperty("questions").EnumerateArray().ToList();

    private static JsonElement LoadLessonRoot(int lessonId)
    {
        var fileName = lessonId == 1 ? "questions.json" : $"questions{lessonId}.json";
        var path = Path.Combine(LessonsDirectory(), fileName);
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static string LessonsDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "Trale", "Lessons", "GeorgianAlphabetProgressive");
            if (Directory.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Could not locate src/Trale/Lessons/GeorgianAlphabetProgressive.");
    }
}
