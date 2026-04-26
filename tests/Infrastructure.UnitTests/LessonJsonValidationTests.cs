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

            var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : "?";
            var correctOption = opts.EnumerateArray().ElementAt(ai.GetInt32()).GetString();
            tr.GetString().ShouldBe(correctOption,
                $"'{relativePath}' question '{id}': transcript must equal options[answer_index]");
        }
    }
}
