using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Application.Verbs;

/// <summary>A Georgian verb as the English Wiktionary has it — with or without a conjugation table.</summary>
/// <param name="Russian">Russian infinitives the Russian Wiktionary gives for it; often empty.</param>
public record LexiconVerb(
    string Lemma, string? Masdar, bool HasTable, IReadOnlyList<string> English, IReadOnlyList<string> Russian)
{
    public string Source => $"https://en.wiktionary.org/wiki/{Uri.EscapeDataString(Lemma)}#Georgian";
}

/// <summary>
/// Open data the translation agent is checked against — code over data, not a second opinion of a model:
/// <list type="bullet">
/// <item>the lexicon: every Georgian verb of the English Wiktionary (about a thousand, most of them
///   without a conjugation table) with its verbal noun and glosses — "is this lemma a real verb, and
///   what does the source say it means";</item>
/// <item>attested forms: word forms seen in real texts (Leipzig corpora, Tatoeba) as a Bloom filter —
///   "has anyone ever written this form".</item>
/// </list>
/// Both are built offline by <c>scripts/verbs/build-lexicon.mjs</c> and <c>build-attested.mjs</c>
/// (sources and licences: <c>scripts/verbs/SOURCES.md</c>) and loaded once at startup.
/// </summary>
public interface IVerbLexicon
{
    /// <summary>The verb with this dictionary form, or the verbs with this verbal noun.</summary>
    IReadOnlyList<LexiconVerb> Find(string lemmaOrMasdar);

    /// <summary>Verbs the source translates with exactly this Russian infinitive.</summary>
    IReadOnlyList<LexiconVerb> FindByRussian(string infinitive);

    /// <summary>Whether the word form occurs in the corpora. False when the data is not loaded.</summary>
    bool IsAttested(string form);

    /// <summary>False when the attested-forms data is missing: then "not attested" means nothing.</summary>
    bool HasAttestedForms { get; }
}

public class VerbLexicon : IVerbLexicon
{
    public const string LexiconFile = "lexicon.json";
    public const string AttestedFile = "attested.bloom";

    private readonly Dictionary<string, LexiconVerb> _byLemma = new();
    private readonly ILookup<string, LexiconVerb> _byMasdar;
    private readonly ILookup<string, LexiconVerb> _byRussian;
    private readonly byte[]? _bloom;
    private readonly uint _bits;
    private readonly int _hashes;

    public static readonly VerbLexicon Empty = new(null, null);

    /// <param name="lexiconJson">Content of <see cref="LexiconFile"/>, or null.</param>
    /// <param name="attested">Content of <see cref="AttestedFile"/>, or null.</param>
    public VerbLexicon(string? lexiconJson, byte[]? attested)
    {
        if (lexiconJson != null)
        {
            using var document = JsonDocument.Parse(lexiconJson);
            // One row per verb: [lemma, masdar | null, has a table, English glosses, Russian infinitives].
            foreach (var row in document.RootElement.GetProperty("verbs").EnumerateArray())
            {
                var verb = new LexiconVerb(
                    row[0].GetString()!,
                    row[1].GetString(),
                    row[2].GetInt32() == 1,
                    row[3].EnumerateArray().Select(g => g.GetString()!).ToList(),
                    row[4].EnumerateArray().Select(g => g.GetString()!).ToList());
                _byLemma[verb.Lemma] = verb;
            }
        }

        _byMasdar = _byLemma.Values.Where(v => v.Masdar != null).ToLookup(v => v.Masdar!);
        _byRussian = _byLemma.Values.SelectMany(v => v.Russian.Select(r => (r, v))).ToLookup(x => x.r, x => x.v);

        // "TBF1", bit count (uint32 LE), hash count (1 byte), bits.
        if (attested is { Length: > 9 } && Encoding.ASCII.GetString(attested, 0, 4) == "TBF1")
        {
            _bits = BitConverter.ToUInt32(attested, 4);
            _hashes = attested[8];
            _bloom = attested;
        }
    }

    /// <summary>Loads both files from a directory; a missing file just switches its checks off.</summary>
    public static VerbLexicon Load(string directory)
    {
        var lexicon = Path.Combine(directory, LexiconFile);
        var attested = Path.Combine(directory, AttestedFile);
        return new VerbLexicon(
            File.Exists(lexicon) ? File.ReadAllText(lexicon) : null,
            File.Exists(attested) ? File.ReadAllBytes(attested) : null);
    }

    public bool HasAttestedForms => _bloom != null;

    public IReadOnlyList<LexiconVerb> Find(string lemmaOrMasdar) =>
        _byLemma.TryGetValue(lemmaOrMasdar, out var verb) ? [verb] : _byMasdar[lemmaOrMasdar].ToList();

    public IReadOnlyList<LexiconVerb> FindByRussian(string infinitive) =>
        _byRussian[infinitive.Trim().ToLowerInvariant().Replace('ё', 'е')].ToList();

    public bool IsAttested(string form)
    {
        if (_bloom == null)
        {
            return false;
        }

        var bytes = Encoding.UTF8.GetBytes(form);
        var h1 = Fnv(bytes, 0x811c9dc5);
        var h2 = Fnv(bytes, 0x01000193) | 1;
        for (var i = 0; i < _hashes; i++)
        {
            var bit = unchecked(h1 + (uint)i * h2) % _bits;
            if ((_bloom[9 + (bit >> 3)] & (1 << (int)(bit & 7))) == 0)
            {
                return false;
            }
        }

        return true;
    }

    // FNV-1a over UTF-8 with two starting values — the same pair as in scripts/verbs/build-attested.mjs.
    private static uint Fnv(byte[] bytes, uint basis)
    {
        var hash = basis;
        foreach (var b in bytes)
        {
            hash = unchecked((hash ^ b) * 0x01000193);
        }

        return hash;
    }
}
