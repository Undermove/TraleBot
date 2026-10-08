using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Application.Verbs;

/// <summary>One verb of a family: the family's base verb or the same verb with a direction prefix.</summary>
/// <param name="Role"><see cref="VerbFamilyCatalog.Base"/> or <see cref="VerbFamilyCatalog.Member"/>.</param>
/// <param name="Prefixes">The prefixes its forms start with; the first is the verb's own.</param>
/// <param name="Direction">Where on the family scheme it sits: up, down, in, out, across, or none for the plain "there / here" pair.</param>
/// <param name="Toward">"there" (away from the speaker) or "here" (towards the speaker).</param>
/// <param name="DirectionRu">The direction in Russian, from the prefixes lesson; null for the plain pair.</param>
public record VerbFamilyMember(
    string Lemma, string Role, IReadOnlyList<string> Prefixes, string Direction, string Toward, string? DirectionRu);

/// <param name="BaseName">How the base verb is called in Russian copy («идти»).</param>
/// <param name="LessonModule">The lesson module that teaches direction prefixes.</param>
/// <param name="IntroLessons">Its lessons whose theory makes the introduction of the first prefix session.</param>
public record VerbFamily(
    string Id,
    string Title,
    string BaseName,
    string Base,
    string LessonModule,
    IReadOnlyList<int> IntroLessons,
    IReadOnlyList<VerbFamilyMember> Members)
{
    /// <summary>The name of the family's card in the ladder (<see cref="VerbPlace.PackId"/> of its verbs).</summary>
    public string CardId => VerbFamilyCatalog.CardPrefix + Id;
}

/// <summary>
/// Verb families: one verb with different direction prefixes («идти» → «выходить», «входить»…).
/// Read once from <c>src/Trale/Verbs/families.json</c>, which <c>scripts/verbs/build-families.mjs</c>
/// derives from the curated catalog and verifies cell by cell (the tables are in
/// <c>scripts/verbs/FAMILIES.md</c>). Only families enabled there are known here; a verb that is
/// merely related to a family is an ordinary verb. Model-made verbs never join a family.
/// </summary>
public class VerbFamilyCatalog
{
    public const string Base = "base";
    public const string Member = "member";

    /// <summary>Same value as FAMILY_PREFIX in <c>scripts/verbs/build-levels.mjs</c>.</summary>
    public const string CardPrefix = "family-";

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public static readonly VerbFamilyCatalog Empty = new(Array.Empty<VerbFamily>());

    private readonly Dictionary<string, (VerbFamily Family, VerbFamilyMember Member)> _byLemma = new();

    public VerbFamilyCatalog(IReadOnlyList<VerbFamily> families)
    {
        Families = families;
        foreach (var family in families)
        {
            foreach (var member in family.Members)
            {
                _byLemma[member.Lemma] = (family, member);
            }
        }
    }

    public IReadOnlyList<VerbFamily> Families { get; }

    public VerbFamily? Find(string id) => Families.FirstOrDefault(f => f.Id == id);

    /// <summary>The family the verb belongs to and its place in it; null for an ordinary verb.</summary>
    public (VerbFamily Family, VerbFamilyMember Member)? Of(string lemma) =>
        _byLemma.TryGetValue(lemma, out var found) ? found : null;

    /// <summary>The base verb's lemma when <paramref name="lemma"/> is the same verb with a prefix; null for the base itself and for ordinary verbs.</summary>
    public string? BaseOf(string lemma) =>
        _byLemma.TryGetValue(lemma, out var found) && found.Member.Role == Member ? found.Family.Base : null;

    public static VerbFamilyCatalog Parse(string json)
    {
        var file = JsonSerializer.Deserialize<FamiliesFile>(json, Json);
        var families = (file?.Families ?? new List<FamilyRow>())
            .Where(f => f.Enabled && f.Base != null)
            .Select(f => new VerbFamily(
                f.Id, f.Title, f.BaseName, f.Base!, f.LessonModule ?? "", f.IntroLessons ?? new List<int>(),
                f.Members.Select(m => new VerbFamilyMember(m.Lemma, m.Role, m.Prefixes, m.Direction, m.Toward, m.DirectionRu)).ToList()))
            .ToList();
        return new VerbFamilyCatalog(families);
    }

    /// <summary>The catalog from the file, or an empty one when the file is missing — every verb is then an ordinary verb.</summary>
    public static VerbFamilyCatalog Load(string path) => File.Exists(path) ? Parse(File.ReadAllText(path)) : Empty;

    private record FamiliesFile(List<FamilyRow> Families);

    private record FamilyRow(
        string Id, string Title, string BaseName, bool Enabled, string? Base, string? LessonModule, List<int>? IntroLessons, List<MemberRow> Members);

    private record MemberRow(string Lemma, string Role, List<string> Prefixes, string Direction, string Toward, string? DirectionRu);
}
