using System.Text.RegularExpressions;
using Shouldly;

namespace Infrastructure.UnitTests;

// Guards src/Trale/wwwroot/index.html against referencing Vite-generated bundle
// hashes that no longer exist on disk.
//
// Failure scenario: dotnet build regenerates wwwroot/index.html (via something in
// the .csproj or msbuild flow) referencing a fresh hash, but vite hasn't been
// re-run, so assets/index-<hash>.js / .css are stale. Browser fetches the new
// hash → 404 → React never starts → mini-app shows blank screen.
//
// When this test fails, the fix is: cd src/Trale/miniapp-src && npm run build
public class MiniappBundleConsistencyTests
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

    private static readonly Regex AssetReferenceRegex = new(
        @"(?:src|href)\s*=\s*""(/assets/[A-Za-z0-9_\-\.]+)""",
        RegexOptions.Compiled);

    [Test]
    public void Index_html_references_existing_assets()
    {
        var indexHtml = Path.Combine(RepoRoot, "src/Trale/wwwroot/index.html");
        var assetsDir = Path.Combine(RepoRoot, "src/Trale/wwwroot/assets");

        if (!File.Exists(indexHtml))
            Assert.Inconclusive($"index.html not found at {indexHtml} — skipping bundle check.");

        if (!Directory.Exists(assetsDir))
            Assert.Inconclusive($"wwwroot/assets/ not found — skipping bundle check.");

        var html = File.ReadAllText(indexHtml);
        var referencedPaths = AssetReferenceRegex.Matches(html)
            .Select(m => m.Groups[1].Value)
            .Where(p => p.StartsWith("/assets/index-"))  // only fingerprinted Vite bundle, ignore /assets/audio/* etc.
            .Distinct()
            .ToList();

        referencedPaths.Count.ShouldBeGreaterThan(0,
            "index.html should reference at least one /assets/index-*.js bundle");

        var missing = new List<string>();
        foreach (var refPath in referencedPaths)
        {
            // refPath looks like "/assets/index-AbCd1234.js"
            var fileName = Path.GetFileName(refPath);
            var fullPath = Path.Combine(assetsDir, fileName);
            if (!File.Exists(fullPath))
                missing.Add(refPath);
        }

        if (missing.Count > 0)
        {
            var existing = Directory.EnumerateFiles(assetsDir, "index-*")
                .Select(Path.GetFileName)
                .ToList();

            var msg =
                $"index.html references {missing.Count} bundle file(s) that don't exist on disk:\n" +
                string.Join("\n", missing.Select(m => $"  - {m}")) +
                "\n\nFiles actually in wwwroot/assets/:\n" +
                string.Join("\n", existing.Select(e => $"  - {e}")) +
                "\n\nFix: cd src/Trale/miniapp-src && npm run build";

            Assert.Fail(msg);
        }
    }
}
