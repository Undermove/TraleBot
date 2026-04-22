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
}
