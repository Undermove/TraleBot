using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Application.Verbs;

/// <summary>A verb form with the cell of the paradigm it sits in — enough to say what the form means.</summary>
public record VerbStoryForm(string Form, string Tense, int Person);

/// <summary>One comic frame with its line already resolved from the verb catalog.</summary>
public record VerbStoryFrame(
    string Image,
    string Who,
    string Scene,
    string Mode,
    long SentenceId,
    string Ka,
    string Ru,
    string SourceRu,
    bool RuAdapted,
    VerbStoryForm Target,
    IReadOnlyList<VerbStoryForm> Options);

public record VerbStory(string Id, string VerbId, string Title, string Images, IReadOnlyList<VerbStoryFrame> Frames);

/// <summary>
/// Comic stories ("кадр под замком") of the verbs layer, kept in memory: a handful of small files
/// (<c>src/Trale/Verbs/stories/*.json</c>) loaded once at startup.
/// A story file never carries Georgian sentences: each frame names a sentence of the verb catalog by
/// its Tatoeba id, and the line is resolved here. A story that does not resolve is reported and
/// skipped, so broken content never reaches a learner and never takes the app down.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbStoryCatalog
{
    /// <summary>Every frame ships in these three files: <c>{image}-800.webp</c>, <c>-480</c>, <c>-ph</c> (placeholder).</summary>
    public static readonly IReadOnlyList<string> ImageSizes = new[] { "800", "480", "ph" };

    public static readonly IReadOnlyList<string> Modes = new[] { "choose", "type", "build" };

    private static readonly Regex GeorgianWord = new("[ა-ჰ]+", RegexOptions.Compiled);
    private static readonly Regex Slug = new("^[a-z0-9-]+$", RegexOptions.Compiled);
    private static readonly Regex ImagesPath = new("^[a-z0-9-]+/[0-9a-f]{10}$", RegexOptions.Compiled);

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private IReadOnlyDictionary<string, IReadOnlyList<VerbStory>> _byVerb =
        new Dictionary<string, IReadOnlyList<VerbStory>>();

    public record LoadResult(IReadOnlyList<VerbStory> Stories, IReadOnlyList<string> Errors);

    public IReadOnlyList<VerbStory> ForVerb(string lemma) =>
        _byVerb.TryGetValue(lemma, out var stories) ? stories : Array.Empty<VerbStory>();

    /// <summary>
    /// Replaces the loaded stories with the ones that resolve against <paramref name="catalogJson"/>.
    /// </summary>
    /// <param name="catalogJson">Content of <c>verbs.json</c>.</param>
    /// <param name="storyFiles">File name without extension → file content.</param>
    /// <param name="imageExists">
    /// Given a path relative to the stories image root (<c>go-fishing/0123456789/f1-800.webp</c>) says
    /// whether the file is there. Null skips the check: at runtime frames are static files of the
    /// mini-app build, so their presence is pinned by a test against the repository instead.
    /// </param>
    public LoadResult Load(
        string catalogJson,
        IReadOnlyDictionary<string, string> storyFiles,
        Func<string, bool>? imageExists = null)
    {
        var result = Resolve(catalogJson, storyFiles, imageExists);
        _byVerb = result.Stories
            .GroupBy(s => s.VerbId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<VerbStory>)g.ToList());
        return result;
    }

    public static LoadResult Resolve(
        string catalogJson,
        IReadOnlyDictionary<string, string> storyFiles,
        Func<string, bool>? imageExists = null)
    {
        var verbs = ReadCatalog(catalogJson);
        var stories = new List<VerbStory>();
        var errors = new List<string>();

        foreach (var (name, json) in storyFiles.OrderBy(f => f.Key, StringComparer.Ordinal))
        {
            var problems = new List<string>();
            var story = ResolveStory(name, json, verbs, imageExists, problems);
            if (story != null && problems.Count == 0)
            {
                stories.Add(story);
            }

            errors.AddRange(problems.Select(p => $"{name}: {p}"));
        }

        return new LoadResult(stories, errors);
    }

    private static VerbStory? ResolveStory(
        string name,
        string json,
        IReadOnlyDictionary<string, CatalogVerb> verbs,
        Func<string, bool>? imageExists,
        List<string> problems)
    {
        StoryFile? file;
        try
        {
            file = JsonSerializer.Deserialize<StoryFile>(json, Json);
        }
        catch (JsonException ex)
        {
            problems.Add($"not valid JSON ({ex.Message})");
            return null;
        }

        if (file == null || file.Id != name || !Slug.IsMatch(name))
        {
            problems.Add("'id' must equal the file name and consist of a-z, 0-9 and '-'");
            return null;
        }

        if (string.IsNullOrWhiteSpace(file.Title))
        {
            problems.Add("'title' is empty");
        }

        if (file.Images == null || !ImagesPath.IsMatch(file.Images) || !file.Images.StartsWith(name + "/"))
        {
            problems.Add($"'images' must be '{name}/<10 hex chars>' as printed by scripts/verbs/story-frames.mjs");
        }

        if (file.Verb == null || !verbs.TryGetValue(file.Verb, out var verb))
        {
            problems.Add($"verb '{file.Verb}' is not in the catalog");
            return null;
        }

        if (file.Frames == null || file.Frames.Count == 0)
        {
            problems.Add("no frames");
            return null;
        }

        var frames = new List<VerbStoryFrame>();
        for (var i = 0; i < file.Frames.Count; i++)
        {
            var before = problems.Count;
            var frame = ResolveFrame(file.Frames[i], verb, file.Images, imageExists, problems);
            for (var p = before; p < problems.Count; p++)
            {
                problems[p] = $"frame {i + 1}: {problems[p]}";
            }

            if (frame != null)
            {
                frames.Add(frame);
            }
        }

        return new VerbStory(name, file.Verb, file.Title ?? string.Empty, file.Images ?? string.Empty, frames);
    }

    private static VerbStoryFrame? ResolveFrame(
        FrameFile frame,
        CatalogVerb verb,
        string? images,
        Func<string, bool>? imageExists,
        List<string> problems)
    {
        if (frame.Image == null || !Slug.IsMatch(frame.Image))
        {
            problems.Add("'image' must consist of a-z, 0-9 and '-'");
        }
        else if (imageExists != null && images != null)
        {
            problems.AddRange(ImageSizes
                .Select(size => $"{images}/{frame.Image}-{size}.webp")
                .Where(path => !imageExists(path))
                .Select(path => $"image file '{path}' is missing"));
        }

        if (string.IsNullOrWhiteSpace(frame.Who) || string.IsNullOrWhiteSpace(frame.Scene))
        {
            problems.Add("'who' and 'scene' are required");
        }

        if (frame.AdaptedRu != null && string.IsNullOrWhiteSpace(frame.AdaptedRu))
        {
            problems.Add("'adaptedRu' is empty — drop the field to use the source translation");
        }

        if (frame.Mode == null || !Modes.Contains(frame.Mode))
        {
            problems.Add($"'mode' must be one of: {string.Join(", ", Modes)}");
        }

        if (!verb.Sentences.TryGetValue(frame.Sentence, out var sentence))
        {
            problems.Add($"sentence {frame.Sentence} is not among the catalog sentences of '{verb.Lemma}' " +
                         "(rebuild the catalog: node scripts/verbs/build-catalog.mjs)");
            return null;
        }

        var words = GeorgianWord.Matches(sentence.Ka).Select(m => m.Value).ToList();
        var target = FormOf(verb, frame.Form, "'form'", problems);
        if (target != null && words.Count(w => w == target.Form) != 1)
        {
            problems.Add($"'form' {target.Form} must occur exactly once in sentence {frame.Sentence}");
        }

        var options = new List<VerbStoryForm>();
        if (frame.Mode == "choose")
        {
            var given = frame.Options ?? new List<string>();
            if (given.Count < 2 || given.Distinct().Count() != given.Count || !given.Contains(frame.Form ?? string.Empty))
            {
                problems.Add("'options' must be at least two distinct forms, one of them the 'form'");
            }

            options.AddRange(given.Select(o => FormOf(verb, o, "option", problems)).OfType<VerbStoryForm>());
        }
        else if (frame.Options != null)
        {
            problems.Add("'options' only make sense with mode 'choose'");
        }

        if (frame.Mode == "build" && words.Count < 2)
        {
            problems.Add($"sentence {frame.Sentence} is a single word — nothing to build");
        }

        if (target == null)
        {
            return null;
        }

        return new VerbStoryFrame(
            frame.Image ?? string.Empty,
            frame.Who ?? string.Empty,
            frame.Scene ?? string.Empty,
            frame.Mode ?? string.Empty,
            frame.Sentence,
            sentence.Ka,
            frame.AdaptedRu ?? sentence.Ru,
            sentence.Ru,
            frame.AdaptedRu != null,
            target,
            options);
    }

    private static VerbStoryForm? FormOf(CatalogVerb verb, string? form, string what, List<string> problems)
    {
        if (form != null && verb.Forms.TryGetValue(form, out var cell))
        {
            return new VerbStoryForm(form, cell.Tense, cell.Person);
        }

        problems.Add($"{what} '{form}' is not a form of '{verb.Lemma}' in the catalog");
        return null;
    }

    private static Dictionary<string, CatalogVerb> ReadCatalog(string catalogJson)
    {
        var entries = JsonNode.Parse(catalogJson)?["verbs"]?.AsArray()
                      ?? throw new InvalidOperationException("Verb catalog has no 'verbs' array");

        var verbs = new Dictionary<string, CatalogVerb>();
        foreach (var node in entries)
        {
            var entry = node!.AsObject();
            var lemma = entry["lemma"]!.GetValue<string>();

            // The main paradigm first, then the parallel tables (another preverb): a form that sits
            // in several cells is explained by the first one, the same way the parse endpoint orders hits.
            var tables = new List<JsonObject> { entry["tenses"]!.AsObject() };
            tables.AddRange((entry["alt"]?.AsArray() ?? new JsonArray()).Select(t => t!.AsObject()));
            var forms = new Dictionary<string, (string Tense, int Person)>();
            foreach (var table in tables)
            {
                foreach (var (tense, persons) in table)
                {
                    var rows = persons!.AsArray();
                    for (var person = 0; person < rows.Count; person++)
                    {
                        foreach (var variant in rows[person]!.AsArray())
                        {
                            forms.TryAdd(variant!.GetValue<string>(), (tense, person));
                        }
                    }
                }
            }

            var sentences = (entry["sentences"]?.AsArray() ?? new JsonArray())
                .GroupBy(s => s!["id"]!.GetValue<long>())
                .ToDictionary(
                    g => g.Key,
                    g => (g.First()!["ka"]!.GetValue<string>(), g.First()!["ru"]!.GetValue<string>()));

            verbs[lemma] = new CatalogVerb(lemma, forms, sentences);
        }

        return verbs;
    }

    private record CatalogVerb(
        string Lemma,
        IReadOnlyDictionary<string, (string Tense, int Person)> Forms,
        IReadOnlyDictionary<long, (string Ka, string Ru)> Sentences);

    // ReSharper disable once ClassNeverInstantiated.Local
    private sealed class StoryFile
    {
        public string? Id { get; set; }
        public string? Verb { get; set; }
        public string? Title { get; set; }
        public string? Images { get; set; }
        public List<FrameFile>? Frames { get; set; }
    }

    // ReSharper disable once ClassNeverInstantiated.Local
    private sealed class FrameFile
    {
        public string? Image { get; set; }
        public string? Who { get; set; }
        public string? Scene { get; set; }
        public long Sentence { get; set; }
        public string? Form { get; set; }
        public string? Mode { get; set; }
        public List<string>? Options { get; set; }
        public string? AdaptedRu { get; set; }
    }
}
