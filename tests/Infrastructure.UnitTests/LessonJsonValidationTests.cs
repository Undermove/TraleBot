using System.Text.Json;
using Shouldly;

namespace Infrastructure.UnitTests;

// Guards src/Trale/Lessons/**/*.json against parse errors without requiring Docker.
public class LessonJsonValidationTests
{
    private static readonly string RepoRoot = FindRepoRoot();

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

    public static IEnumerable<string> AllLessonJsonFiles()
    {
        var lessonsDir = Path.Combine(RepoRoot, "src/Trale/Lessons");
        if (!Directory.Exists(lessonsDir))
            yield break;
        foreach (var file in Directory.EnumerateFiles(lessonsDir, "*.json", SearchOption.AllDirectories))
            yield return Path.GetRelativePath(RepoRoot, file);
    }

    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Json_file_is_valid(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        var content = File.ReadAllText(fullPath);
        Should.NotThrow(
            () => { using var _ = JsonDocument.Parse(content); },
            $"Lesson file '{relativePath}' must be valid JSON");
    }

    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Json_file_answer_indices_are_in_bounds(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("options", out var options) || options.ValueKind != JsonValueKind.Array) continue;
            if (!q.TryGetProperty("answer_index", out var ai)) continue;

            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var count = options.GetArrayLength();
            var idx = ai.GetInt32();
            idx.ShouldBeInRange(0, count - 1,
                $"'{relativePath}' question '{id}': answer_index {idx} out of range [0,{count - 1}]");
        }
    }

    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Audio_choice_questions_reference_existing_static_files(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("question_type", out var qt) || qt.GetString() != "audio-choice") continue;

            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";

            q.TryGetProperty("audio_url", out var audioUrl).ShouldBeTrue(
                $"'{relativePath}' question '{id}': audio-choice must have audio_url");
            q.TryGetProperty("transcript", out _).ShouldBeTrue(
                $"'{relativePath}' question '{id}': audio-choice must have transcript");

            var url = audioUrl.GetString() ?? "";
            if (!url.StartsWith('/')) continue;

            // audio_url "/audio/..." → src/Trale/miniapp-src/public/audio/...
            var fileRel = url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var filePath = Path.Combine(RepoRoot, "src", "Trale", "miniapp-src", "public", fileRel);
            File.Exists(filePath).ShouldBeTrue(
                $"'{relativePath}' question '{id}': audio_url '{url}' → missing file at {filePath}");
        }
    }

    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Audio_choice_transcript_matches_correct_option(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("question_type", out var qt) || qt.GetString() != "audio-choice") continue;
            if (!q.TryGetProperty("transcript", out var tr) || tr.ValueKind != JsonValueKind.String) continue;
            if (!q.TryGetProperty("options", out var opts) || opts.ValueKind != JsonValueKind.Array) continue;
            if (!q.TryGetProperty("answer_index", out var ai)) continue;

            // letter-name audio: the audio plays the full letter name (e.g. "ანი") while
            // the correct option is the letter symbol ("ა"). Transcript ≠ option is intentional.
            if (q.TryGetProperty("tags", out var tags) &&
                tags.EnumerateArray().Any(t => t.GetString() == "letter-name")) continue;

            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var correctOption = opts.EnumerateArray().ElementAt(ai.GetInt32()).GetString();
            tr.GetString().ShouldBe(correctOption,
                $"'{relativePath}' question '{id}': transcript must equal options[answer_index]");
        }
    }

    // Guards against Cyrillic characters (e.g. А U+0410) mixed into Georgian words —
    // visually identical to some Georgian letters but causes search/comparison failures
    // (as seen in taxi6-q09 where Cyrillic А was inside Georgian text in lemma, options,
    // explanation, and transcript fields simultaneously).
    // Only flags strings that contain BOTH Georgian and Cyrillic characters — purely
    // Cyrillic lemmas (e.g. grammar-metadata tags) are a separate content-quality issue.
    // For audio-choice questions, options must also be pure Georgian (they are the heard words).
    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Georgian_text_fields_must_not_mix_Georgian_and_Cyrillic(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var isAudioChoice = q.TryGetProperty("question_type", out var qt) && qt.GetString() == "audio-choice";

            foreach (var field in new[] { "lemma", "transcript" })
            {
                if (!q.TryGetProperty(field, out var el) || el.ValueKind != JsonValueKind.String) continue;
                AssertNoMixedScript(relativePath, id!, field, el.GetString() ?? "");
            }

            // audio-choice options are always pure Georgian words — guard them too
            if (isAudioChoice && q.TryGetProperty("options", out var opts) && opts.ValueKind == JsonValueKind.Array)
            {
                var optIndex = 0;
                foreach (var opt in opts.EnumerateArray())
                {
                    if (opt.ValueKind == JsonValueKind.String)
                        AssertNoMixedScript(relativePath, id!, $"options[{optIndex}]", opt.GetString() ?? "");
                    optIndex++;
                }
            }
        }
    }

    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Explanation_field_must_not_contain_CJK_or_unexpected_scripts(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            if (!q.TryGetProperty("explanation", out var expl) || expl.ValueKind != JsonValueKind.String) continue;
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var text = expl.GetString() ?? "";
            AssertNoCjk(relativePath, id!, "explanation", text);
        }
    }

    // Guards against Georgian chars embedded inside Cyrillic words (e.g. выბeri where
    // ბ U+10D1 visually resembles Cyrillic б U+0431). Fires when a Georgian char has
    // both its direct left and right neighbours as Cyrillic letters — unambiguous substitution.
    // Does NOT fire for Georgian words quoted within Russian text («…» pattern), because
    // those have guillemets or spaces as neighbours.
    [TestCaseSource(nameof(AllLessonJsonFiles))]
    public void Question_and_explanation_fields_must_not_embed_Georgian_inside_Cyrillic_words(string relativePath)
    {
        var fullPath = Path.Combine(RepoRoot, relativePath);
        using var doc = JsonDocument.Parse(File.ReadAllText(fullPath));
        if (!doc.RootElement.TryGetProperty("questions", out var questions)) return;

        foreach (var q in questions.EnumerateArray())
        {
            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            foreach (var fieldName in new[] { "question", "explanation" })
            {
                if (!q.TryGetProperty(fieldName, out var el) || el.ValueKind != JsonValueKind.String) continue;
                var text = el.GetString() ?? "";
                for (var i = 0; i < text.Length; i++)
                {
                    var ch = text[i];
                    if (ch < 'ა' || ch > 'ჿ') continue;
                    var prev = i > 0 ? text[i - 1] : '\0';
                    var next = i + 1 < text.Length ? text[i + 1] : '\0';
                    var prevIsCyrillic = prev >= 'Ѐ' && prev <= 'ԯ';
                    var nextIsCyrillic = next >= 'Ѐ' && next <= 'ԯ';
                    if (prevIsCyrillic && nextIsCyrillic)
                    {
                        false.ShouldBeTrue(
                            $"'{relativePath}' question '{id}' field '{fieldName}': Georgian char U+{(int)ch:X4} '{ch}' is embedded inside a Cyrillic word at position {i} — likely accidental substitution (e.g. Georgian ბ instead of Cyrillic б). Context: '{text[Math.Max(0, i - 6)..Math.Min(text.Length, i + 7)]}'");
                    }
                }
            }
        }
    }

    private static void AssertNoMixedScript(string file, string questionId, string field, string text)
    {
        var hasGeorgian = text.Any(c => c >= 'ა' && c <= 'ჿ');
        var cyrillic = text.Where(c => c >= 'Ѐ' && c <= 'ԯ').ToList();
        if (!hasGeorgian || cyrillic.Count == 0) return;
        cyrillic.ShouldBeEmpty(
            $"'{file}' question '{questionId}' field '{field}': mixes Georgian and Cyrillic — {string.Join(", ", cyrillic.Select(c => $"U+{(int)c:X4} '{c}'"))} found in '{text}'");
    }

    private static void AssertNoCjk(string file, string questionId, string field, string text)
    {
        var cjk = text.Where(c => (c >= '一' && c <= '鿿') || (c >= '　' && c <= '〿')).ToList();
        cjk.ShouldBeEmpty(
            $"'{file}' question '{questionId}' field '{field}': contains CJK characters — {string.Join(", ", cjk.Select(c => $"U+{(int)c:X4} '{c}'"))} — likely an AI generation artefact");
    }
}
