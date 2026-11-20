using System.IO;
using System.Linq;
using NUnit.Framework;
using Shouldly;
using Trale.MiniApp;

namespace Infrastructure.UnitTests.MiniApp;

// The treasure words and postcards of the gift of the day: every entry complete, ids unique, voice-over present.
[TestFixture]
public class TreasureCatalogTests
{
    private static string Repo => Path.GetFullPath(Path.Combine(TestContext.CurrentContext.TestDirectory, "../../../../.."));

    [Test]
    public void Every_word_and_postcard_is_complete_with_a_unique_id_and_audio()
    {
        var catalog = new TreasureCatalog(Path.Combine(Repo, "src/Trale/Lessons/Treasures/treasures.json"));

        catalog.Words.Count.ShouldBeGreaterThan(10);
        catalog.Cards.Count.ShouldBeGreaterThan(10);
        var ids = catalog.Words.Select(w => w.Id).Concat(catalog.Cards.Select(c => c.Id)).ToList();
        ids.Distinct().Count().ShouldBe(ids.Count);
        foreach (var w in catalog.Words)
        {
            new[] { w.Ka, w.Tr, w.Ru, w.Story }.ShouldAllBe(s => !string.IsNullOrWhiteSpace(s), w.Id);
            w.Tr.Any(c => c is >= 'a' and <= 'z').ShouldBeFalse($"{w.Id}: transcription must be Cyrillic");
        }
        foreach (var c in catalog.Cards)
        {
            new[] { c.Ka, c.Tr, c.Ru, c.When }.ShouldAllBe(s => !string.IsNullOrWhiteSpace(s), c.Id);
        }
        foreach (var id in ids)
        {
            File.Exists(Path.Combine(Repo, $"src/Trale/miniapp-src/public/audio/treasures/{id}.m4a")).ShouldBeTrue(id);
        }
    }
}
