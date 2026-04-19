using System.Text.RegularExpressions;
using FluentAssertions;

namespace IntegrationTests;

/// <summary>
/// Enforces that FEATURES.md at the repo root lists every user-visible feature
/// implementation that exists in the codebase. If a new bot command, miniapp
/// screen, controller, hosted service, or EF migration is added without a
/// corresponding row in FEATURES.md, this test fails with the exact missing
/// names so the author can update the catalog in the same commit.
///
/// Rule is intentionally dumb — we just grep the FEATURES.md text for the
/// base file name (for .tsx) or the class name (for .cs). That is enough to
/// keep the catalog honest without needing a full AST walk.
/// </summary>
public class FeatureCatalogCoverageTests
{
    private static readonly string RepoRoot = FindRepoRoot();
    private static readonly string FeaturesText = File.ReadAllText(Path.Combine(RepoRoot, "FEATURES.md"));

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "FEATURES.md"))
                && Directory.Exists(Path.Combine(dir.FullName, ".git")))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }
        throw new InvalidOperationException(
            "Could not locate the repo root (directory containing FEATURES.md and .git).");
    }

    private static readonly Regex ConcreteClassRegex = new(
        @"^\s*public\s+(?:sealed\s+)?(?:partial\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)",
        RegexOptions.Multiline | RegexOptions.Compiled);

    /// <summary>Extract names of non-abstract public classes in a .cs file.</summary>
    private static IEnumerable<string> PublicConcreteClasses(string filePath)
    {
        var text = File.ReadAllText(filePath);
        foreach (Match m in ConcreteClassRegex.Matches(text))
        {
            yield return m.Groups[1].Value;
        }
    }

    [Test]
    public void Every_bot_command_class_is_listed_in_FEATURES_md()
    {
        var botCommandsDir = Path.Combine(RepoRoot, "src/Infrastructure/Telegram/BotCommands");
        Directory.Exists(botCommandsDir).Should().BeTrue(
            "bot commands directory must exist for this test to run");

        var files = Directory.EnumerateFiles(botCommandsDir, "*.cs", SearchOption.AllDirectories);

        var missing = new List<string>();
        foreach (var file in files)
        {
            foreach (var className in PublicConcreteClasses(file))
            {
                if (!className.EndsWith("Command", StringComparison.Ordinal)) continue;
                if (!FeaturesText.Contains(className, StringComparison.Ordinal))
                {
                    missing.Add($"  {className} — {Path.GetRelativePath(RepoRoot, file)}");
                }
            }
        }

        missing.Should().BeEmpty(
            because: "every bot command class must be documented in FEATURES.md §1. Missing:\n"
                     + string.Join("\n", missing));
    }

    [Test]
    public void Every_miniapp_screen_file_is_listed_in_FEATURES_md()
    {
        var screensDir = Path.Combine(RepoRoot, "src/Trale/miniapp-src/src/screens");
        Directory.Exists(screensDir).Should().BeTrue("miniapp screens directory must exist");

        var files = Directory.EnumerateFiles(screensDir, "*.tsx", SearchOption.TopDirectoryOnly).ToList();

        var missing = files
            .Select(Path.GetFileName)
            .Where(name => !FeaturesText.Contains(name!, StringComparison.Ordinal))
            .ToList();

        missing.Should().BeEmpty(
            because: "every top-level miniapp screen must be documented in FEATURES.md §2. Missing file names:\n  "
                     + string.Join("\n  ", missing!));
    }

    [Test]
    public void Every_migration_class_is_listed_in_FEATURES_md()
    {
        var migrationsDir = Path.Combine(RepoRoot, "src/Persistence/Migrations");
        Directory.Exists(migrationsDir).Should().BeTrue("migrations directory must exist");

        var files = Directory.EnumerateFiles(migrationsDir, "*.cs", SearchOption.TopDirectoryOnly)
            .Where(f => !f.EndsWith(".Designer.cs"))
            .Where(f => !Path.GetFileName(f).Contains("ModelSnapshot"))
            .ToList();

        var missing = new List<string>();
        foreach (var file in files)
        {
            // Migration file names follow the pattern: {timestamp}_{MigrationClassName}.cs
            var baseName = Path.GetFileNameWithoutExtension(file);
            var underscore = baseName.IndexOf('_');
            if (underscore < 0 || underscore == baseName.Length - 1) continue;
            var migrationName = baseName[(underscore + 1)..];
            if (!FeaturesText.Contains(migrationName, StringComparison.Ordinal))
            {
                missing.Add(migrationName);
            }
        }

        missing.Should().BeEmpty(
            because: "every EF Core migration must be documented in FEATURES.md §5. Missing:\n  "
                     + string.Join("\n  ", missing));
    }

    [Test]
    public void Every_hosted_service_class_is_listed_in_FEATURES_md()
    {
        var hostedDir = Path.Combine(RepoRoot, "src/Trale/HostedServices");
        Directory.Exists(hostedDir).Should().BeTrue("hosted services directory must exist");

        var missing = new List<string>();
        foreach (var file in Directory.EnumerateFiles(hostedDir, "*.cs", SearchOption.TopDirectoryOnly))
        {
            foreach (var className in PublicConcreteClasses(file))
            {
                if (!FeaturesText.Contains(className, StringComparison.Ordinal))
                    missing.Add(className);
            }
        }

        missing.Should().BeEmpty(
            because: "every hosted service must be documented in FEATURES.md §4. Missing:\n  "
                     + string.Join("\n  ", missing));
    }

    [Test]
    public void Every_controller_class_is_listed_in_FEATURES_md()
    {
        var controllersDir = Path.Combine(RepoRoot, "src/Trale/Controllers");
        Directory.Exists(controllersDir).Should().BeTrue("controllers directory must exist");

        var missing = new List<string>();
        foreach (var file in Directory.EnumerateFiles(controllersDir, "*Controller.cs", SearchOption.AllDirectories))
        {
            foreach (var className in PublicConcreteClasses(file))
            {
                if (!className.EndsWith("Controller", StringComparison.Ordinal)) continue;
                if (!FeaturesText.Contains(className, StringComparison.Ordinal))
                    missing.Add(className);
            }
        }

        missing.Should().BeEmpty(
            because: "every HTTP controller must be documented in FEATURES.md §3. Missing:\n  "
                     + string.Join("\n  ", missing));
    }
}
