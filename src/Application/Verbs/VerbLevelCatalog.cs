using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Application.Verbs;

/// <summary>Five verbs (4–6) with a common theme — the unit the section leads a learner through.</summary>
public record VerbPack(string Id, string Title, IReadOnlyList<string> Verbs);

public record VerbLevelGroup(int Id, string Title, IReadOnlyList<VerbPack> Packs);

/// <summary>Where a verb stands in the ladder.</summary>
public record VerbPlace(int LevelId, string PackId, int Order);

/// <summary>
/// The order in which the «Глаголы» section leads a learner through the curated catalog: five
/// levels by frequency, packs of about five verbs by meaning. Read once from
/// <c>src/Trale/Verbs/levels.json</c>, which is built by <c>scripts/verbs/build-levels.mjs</c>
/// (the numbers and the reasons are in <c>scripts/verbs/LEVELS.md</c>). The order is a
/// recommendation: nothing in it locks a verb.
/// </summary>
public class VerbLevelCatalog
{
    public const int PackMin = 4;
    public const int PackMax = 6;

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public static readonly VerbLevelCatalog Empty = new(Array.Empty<VerbLevelGroup>());

    private readonly Dictionary<string, VerbPlace> _places = new();

    public VerbLevelCatalog(IReadOnlyList<VerbLevelGroup> levels)
    {
        Levels = levels;
        var order = 0;
        foreach (var level in levels)
        {
            foreach (var pack in level.Packs)
            {
                foreach (var lemma in pack.Verbs)
                {
                    _places[lemma] = new VerbPlace(level.Id, pack.Id, order++);
                }
            }
        }

        Lemmas = _places.OrderBy(p => p.Value.Order).Select(p => p.Key).ToList();
    }

    public IReadOnlyList<VerbLevelGroup> Levels { get; }

    /// <summary>Every verb of the ladder in the recommended order.</summary>
    public IReadOnlyList<string> Lemmas { get; }

    public VerbPlace? PlaceOf(string lemma) => _places.GetValueOrDefault(lemma);

    public static VerbLevelCatalog Parse(string json)
    {
        var file = JsonSerializer.Deserialize<LevelsFile>(json, Json);
        return new VerbLevelCatalog(file?.Levels ?? new List<VerbLevelGroup>());
    }

    /// <summary>The catalog from the file, or an empty one when the file is missing — the section then shows only "my verbs".</summary>
    public static VerbLevelCatalog Load(string path) => File.Exists(path) ? Parse(File.ReadAllText(path)) : Empty;

    private record LevelsFile(List<VerbLevelGroup> Levels);
}
