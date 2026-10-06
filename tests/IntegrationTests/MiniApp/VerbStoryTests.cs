using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Application.Verbs;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Comic stories are content: <c>src/Trale/Verbs/stories/*.json</c> plus frames under the mini-app's
/// <c>public/stories</c>. These tests keep that content from drifting away from the verb catalog —
/// a story may only say what the sourced data says — and pin how a story reaches the mini-app.
/// </summary>
public class VerbStoryTests : TestBase
{
    private const string Go = "მიდის";

    private static string CatalogJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));

    private static Dictionary<string, string> StoryFiles() =>
        Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Verbs", "stories"), "*.json")
            .ToDictionary(path => Path.GetFileNameWithoutExtension(path), File.ReadAllText);

    /// <summary>Where the frames are committed; found by the solution file, so it works in a git worktree too.</summary>
    private static string ImagesRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "TraleBot.sln")))
        {
            dir = dir.Parent;
        }

        dir.Should().NotBeNull("the tests must run from inside the repository");
        return Path.Combine(dir!.FullName, "src", "Trale", "miniapp-src", "public", "stories");
    }

    private static bool ImageExists(string relativePath) => File.Exists(Path.Combine(ImagesRoot(), relativePath));

    /// <summary>The shipped story with one edit applied — a broken copy to feed the validator.</summary>
    private static Dictionary<string, string> Broken(Action<JsonObject> edit, string fileName = "go-fishing")
    {
        var story = JsonNode.Parse(StoryFiles()["go-fishing"])!.AsObject();
        edit(story);
        return new Dictionary<string, string> { [fileName] = story.ToJsonString() };
    }

    private static JsonObject Frame(JsonObject story, int index) => story["frames"]![index]!.AsObject();

    [Test]
    public void Every_story_in_the_repository_resolves_and_has_all_its_frame_images()
    {
        var files = StoryFiles();

        var result = VerbStoryCatalog.Resolve(CatalogJson(), files, ImageExists);

        files.Should().NotBeEmpty();
        result.Errors.Should().BeEmpty();
        result.Stories.Select(s => s.Id).Should().BeEquivalentTo(files.Keys);
    }

    [Test]
    public void Story_files_do_not_carry_georgian_text_of_their_own()
    {
        var georgian = new Regex("[ა-ჰ]");

        foreach (var (name, json) in StoryFiles())
        {
            foreach (var frame in JsonNode.Parse(json)!["frames"]!.AsArray())
            {
                var handWritten = frame!.AsObject()
                    .Where(p => p.Key != "form" && p.Key != "options")
                    .Where(p => georgian.IsMatch(p.Value!.ToJsonString(new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping })))
                    .Select(p => p.Key);

                handWritten.Should().BeEmpty(
                    because: $"in {name} a line is named by its sentence id and resolved from the catalog; " +
                             "only 'form' and 'options' hold Georgian, and those are checked against the paradigm");
            }
        }
    }

    [Test]
    public void Frame_folder_is_named_by_the_hash_of_its_content()
    {
        foreach (var story in VerbStoryCatalog.Resolve(CatalogJson(), StoryFiles()).Stories)
        {
            var folder = Path.Combine(ImagesRoot(), story.Images);
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            foreach (var file in Directory.GetFiles(folder).OrderBy(Path.GetFileName, StringComparer.Ordinal))
            {
                hash.AppendData(Encoding.UTF8.GetBytes(Path.GetFileName(file)));
                hash.AppendData(new byte[] { 0 });
                hash.AppendData(File.ReadAllBytes(file));
            }

            var expected = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()[..10];

            Path.GetFileName(folder).Should().Be(expected,
                because: "frames are cached forever, so changed bytes need a new path — " +
                         $"rerun scripts/verbs/story-frames.mjs for '{story.Id}'");
            Directory.GetDirectories(Path.Combine(ImagesRoot(), story.Id)).Should().ContainSingle(
                because: "frames of an older version are dead weight in the build");
        }
    }

    [Test]
    public void Lines_are_resolved_from_the_catalog_and_adapted_translations_are_marked()
    {
        var story = VerbStoryCatalog.Resolve(CatalogJson(), StoryFiles()).Stories.Single(s => s.Id == "go-fishing");
        var sentences = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray()
            .Single(v => v!["lemma"]!.GetValue<string>() == Go)!["sentences"]!.AsArray();
        JsonNode Sentence(long id) => sentences.Single(s => s!["id"]!.GetValue<long>() == id)!;

        story.VerbId.Should().Be(Go);
        story.Frames.Should().HaveCount(6);
        story.Frames.Select(f => f.Ka).Should().Equal(story.Frames.Select(f => Sentence(f.SentenceId)["ka"]!.GetValue<string>()));
        story.Frames.Select(f => f.SourceRu).Should().Equal(story.Frames.Select(f => Sentence(f.SentenceId)["ru"]!.GetValue<string>()));

        var asked = story.Frames[0];
        asked.RuAdapted.Should().BeFalse();
        asked.Ru.Should().Be(asked.SourceRu);
        asked.Target.Should().Be(new VerbStoryForm("მიდიხარ", "present", 1, "ты идёшь"),
            because: "the reader explains a wrong pick by what the form means in plain Russian");
        asked.Options.Should().Contain(new VerbStoryForm("მივდივარ", "present", 0, "я иду"));

        var alone = story.Frames[2];
        alone.RuAdapted.Should().BeTrue();
        alone.Ru.Should().Be("Один я пойти не смогу.");
        alone.SourceRu.Should().Be("Я не могу пойти одна.");
        alone.Target.Should().Be(new VerbStoryForm("წავალ", "future", 0, "я буду идти"));

        story.Frames.Where(f => f.RuAdapted).Select(f => f.SentenceId).Should().BeEquivalentTo(new[] { 12012139L, 8090988L });
    }

    [Test]
    public void Story_with_a_sentence_that_is_not_in_the_catalog_is_skipped()
    {
        var result = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s => Frame(s, 0)["sentence"] = 1));

        result.Stories.Should().BeEmpty();
        result.Errors.Should().ContainSingle().Which.Should().Contain("go-fishing: frame 1: sentence 1 is not among the catalog sentences");
    }

    [Test]
    public void Story_whose_form_is_not_in_its_sentence_is_skipped()
    {
        // წავალ is a real form of the verb, but frame 1's sentence has მიდიხარ.
        var result = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s =>
        {
            Frame(s, 0)["form"] = "წავალ";
            Frame(s, 0)["options"] = new JsonArray("წავალ", "მიდის");
        }));

        result.Stories.Should().BeEmpty();
        result.Errors.Should().ContainSingle().Which.Should().Contain("must occur exactly once in sentence 8475459");
    }

    [Test]
    public void Story_whose_form_or_option_belongs_to_another_verb_is_skipped()
    {
        // ვწერ is in the catalog, but it is a form of "to write".
        var form = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s => Frame(s, 3)["form"] = "ვწერ"));
        var option = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s => Frame(s, 0)["options"]!.AsArray().Add("ვწერ")));

        form.Stories.Should().BeEmpty();
        form.Errors.Should().Contain(e => e.Contains("frame 4: 'form' 'ვწერ' is not a form of"));
        option.Stories.Should().BeEmpty();
        option.Errors.Should().ContainSingle().Which.Should().Contain("frame 1: option 'ვწერ' is not a form of");
    }

    [Test]
    public void Story_with_a_missing_frame_image_is_skipped()
    {
        var result = VerbStoryCatalog.Resolve(CatalogJson(), StoryFiles(), path => !path.EndsWith("f2-480.webp") && ImageExists(path));

        result.Stories.Should().NotContain(s => s.Id == "go-fishing");
        result.Errors.Should().ContainSingle().Which.Should().MatchRegex("go-fishing: frame 2: image file 'go-fishing/[0-9a-f]{10}/f2-480.webp' is missing");
    }

    [Test]
    public void Story_with_malformed_structure_is_skipped_without_throwing()
    {
        var wrongName = VerbStoryCatalog.Resolve(CatalogJson(), Broken(_ => { }, fileName: "other-name"));
        var unknownVerb = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s => s["verb"] = "არარსებული"));
        var unknownMode = VerbStoryCatalog.Resolve(CatalogJson(), Broken(s => Frame(s, 4)["mode"] = "sing"));
        var notJson = VerbStoryCatalog.Resolve(CatalogJson(), new Dictionary<string, string> { ["go-fishing"] = "{" });

        new[] { wrongName, unknownVerb, unknownMode, notJson }.Should().OnlyContain(r => r.Stories.Count == 0 && r.Errors.Count > 0);
    }

    [Test]
    public void Broken_story_does_not_take_the_valid_ones_with_it()
    {
        var files = StoryFiles();
        files["broken"] = Broken(s => { s["id"] = "broken"; s["images"] = "broken/0123456789"; Frame(s, 0)["sentence"] = 1; })["go-fishing"];
        var catalog = new VerbStoryCatalog();

        var result = catalog.Load(CatalogJson(), files);

        result.Errors.Should().OnlyContain(e => e.StartsWith("broken: "));
        catalog.ForVerb(Go).Select(s => s.Id).Should().Contain("go-fishing").And.NotContain("broken");
    }

    [Test]
    public void Stories_are_loaded_at_startup_and_served_by_verb()
    {
        var catalog = _testServer.Services.GetRequiredService<VerbStoryCatalog>();

        catalog.ForVerb(Go).Select(s => s.Id).Should().Contain("go-fishing");
        catalog.ForVerb("წერს").Should().BeEmpty();
        catalog.ForVerb("არარსებული").Should().BeEmpty();
    }

    [Test]
    public void Story_is_serialized_in_the_shape_the_miniapp_reads()
    {
        var settings = _testServer.Services.GetRequiredService<IOptions<MvcNewtonsoftJsonOptions>>().Value.SerializerSettings;
        var stories = _testServer.Services.GetRequiredService<VerbStoryCatalog>().ForVerb(Go);

        var frame = JsonNode.Parse(JsonConvert.SerializeObject(new { stories }, settings))!["stories"]![0]!["frames"]![2]!;

        frame["sentenceId"]!.GetValue<long>().Should().Be(12012139);
        frame["mode"]!.GetValue<string>().Should().Be("choose");
        frame["ruAdapted"]!.GetValue<bool>().Should().BeTrue();
        frame["target"]!["tense"]!.GetValue<string>().Should().Be("future");
        frame["target"]!["person"]!.GetValue<int>().Should().Be(0);
        frame["options"]!.AsArray().Select(o => o!["form"]!.GetValue<string>()).Should().Contain("წავედი");
    }

    [Test]
    public async Task Stories_endpoint_requires_authentication()
    {
        var response = await _testServer.CreateClient().GetAsync($"/api/miniapp/verbs/{Go}/stories");

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
