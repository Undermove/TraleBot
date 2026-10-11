using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Translation.Cache;
using Application.Translation.Languages;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

public enum VerbCardKind
{
    /// <summary>A Russian infinitive the base translates: each verb with its key forms.</summary>
    Infinitive,

    /// <summary>A Georgian form: every reading of it — which verb, who, when.</summary>
    Form,

    /// <summary>The Georgian name of an action (the title of a verb card): the verbs it names, with their key forms.</summary>
    ActionName
}

/// <summary>One line of a card: a form of the base with what it says.</summary>
/// <param name="Variants">The form as the base spells it; more than one when the base gives variants.</param>
/// <param name="Meaning">The stored plain-Russian phrase of the cell («я нахожу»); null when the base has none.</param>
/// <param name="Note">Tells apart two tenses with the same phrase («один раз · сделано»); usually null.</param>
/// <param name="Caption">Who and when, in plain words — never a textbook term.</param>
public record VerbCardLine(
    IReadOnlyList<string> Variants, string Tense, int Person, string? Meaning, string? Note, string Caption)
{
    public string Georgian => string.Join(", ", Variants);
    public string Transcription => string.Join(", ", Variants.Select(GeorgianTranscriptionExtension.GetTranscription));
}

/// <param name="ActionName">The name of the action (the card title); null when the base has none of its own for this verb.</param>
public record VerbCardVerb(
    string Lemma, string? ActionName, string Translation, VerbStatus Status, IReadOnlyList<VerbCardLine> Lines)
{
    public string? ActionNameTranscription =>
        ActionName == null ? null : GeorgianTranscriptionExtension.GetTranscription(ActionName);

    public string LemmaTranscription => GeorgianTranscriptionExtension.GetTranscription(Lemma);
}

/// <summary>
/// What a translated word is as a verb of the base — shown instead of a bare one-word translation.
/// Every Georgian word in it is a stored one.
/// </summary>
/// <param name="Text">The looked-up text, normalised.</param>
/// <param name="Verbs">Best first (catalog order); at most <see cref="VerbTranslationCardQuery.MaxVerbs"/>.</param>
/// <param name="MoreVerbs">How many further verbs matched and are not listed.</param>
/// <param name="Related">
/// For an infinitive: glosses of other verbs of the base that are this word with a clarification —
/// «писать (кому-то)» next to «писать». They are other verbs, so they are only named.
/// </param>
public record VerbTranslationCard(
    VerbCardKind Kind, string Text, IReadOnlyList<VerbCardVerb> Verbs, int MoreVerbs = 0, IReadOnlyList<string>? Related = null)
{
    public string TextTranscription => GeorgianTranscriptionExtension.GetTranscription(Text);
}

/// <summary>Order and plain names of tenses for a card. No grammar terms: the time is said by what it says.</summary>
public static class VerbCardWording
{
    public const string ActionName = "название действия";

    private static readonly string[] Who = ["я", "ты", "он/она", "мы", "вы", "они"];

    private static readonly Dictionary<string, string> Time = new()
    {
        ["present"] = "настоящее время",
        ["aorist"] = "прошедшее время: сделал один раз",
        ["imperfect"] = "прошедшее время: делал долго или часто",
        ["future"] = "будущее время",
        ["conditional"] = "«сделал бы»",
        ["presentSubjunctive"] = "«чтобы делал»",
        ["futureSubjunctive"] = "«если бы сделал»",
        ["perfect"] = "«оказывается, сделал»",
        ["pluperfect"] = "«должен был сделать»",
        ["perfectSubjunctive"] = "пожелание или тост"
    };

    /// <summary>Position of a tense among the readings of one form: the ones a learner meets first go first.</summary>
    public static int Rank(string tense) =>
        VerbAnalyzer.KnownTenses.ToList().IndexOf(tense) is >= 0 and var i ? i : int.MaxValue;

    /// <summary>«я, настоящее время»; «чтобы я…» — так говорят после «надо», «хочу».</summary>
    public static string Caption(string tense, int person)
    {
        var who = person is >= 0 and < 6 ? Who[person] : string.Empty;
        if (tense == "optative")
        {
            return $"«чтобы {who}…» — так говорят после «надо», «хочу»";
        }

        return Time.TryGetValue(tense, out var time) ? $"{who}, {time}" : who;
    }
}

/// <summary>
/// Builds the verb card for a looked-up text: a Russian infinitive the base translates, a Georgian
/// form of the base, or the Georgian name of an action. Null for anything else — the reply then looks
/// as it always did. One indexed query for a Georgian word that is a form, one over the verbs
/// otherwise; no model, no network. Service per ARCHITECTURE.md.
/// </summary>
public class VerbTranslationCardQuery(ITraleDbContext dbContext)
{
    public const int MaxVerbs = 3;
    public const int MaxRelated = 4;

    /// <summary>Readings of one form within one verb that are spelled out; the rest are rare tenses.</summary>
    public const int MaxReadingsPerVerb = 4;

    private sealed record VerbRow(string Lemma, string Title, string Translation, VerbStatus Status, int SortOrder, string CardJson);

    /// <summary>
    /// The card for a word a learner of <paramref name="learning"/> looked up. A Russian word is
    /// translated into the language being learned, so it is a Georgian verb only for a learner of
    /// Georgian; a word in Georgian letters is Georgian for everyone.
    /// </summary>
    public Task<VerbTranslationCard?> FindForAsync(string? text, Language learning, CancellationToken ct)
    {
        var georgian = text != null && text.Any(c => c is >= 'ა' and <= 'ჰ');
        return learning == Language.Georgian || georgian ? FindAsync(text, ct) : Task.FromResult<VerbTranslationCard?>(null);
    }

    public async Task<VerbTranslationCard?> FindAsync(string? text, CancellationToken ct)
    {
        var key = TranslationCacheKey.Normalize(text);
        if (key == null || key.Length > VerbParadigm.MaxFormLength)
        {
            return null;
        }

        if (VerbParadigm.GeorgianWord.IsMatch(key))
        {
            return await ForGeorgianFormAsync(key, ct) ?? await ForActionNameAsync(key, ct);
        }

        return key.Any(c => c is >= 'а' and <= 'я') ? await ForRussianAsync(key, ct) : null;
    }

    private async Task<VerbTranslationCard?> ForRussianAsync(string key, CancellationToken ct)
    {
        // The same rule as the translation itself (VerbBaseSearch): «есть, кушать» answers both words,
        // «входить (сюда)» is another verb and does not answer plain «входить».
        var candidates = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Translation.ToLower().Replace("ё", "е").Contains(key))
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new VerbRow(v.Lemma, v.Title, v.Translation, v.Status, v.SortOrder, v.CardJson))
            .ToListAsync(ct);
        var verbs = candidates.Where(v => VerbBaseSearch.RussianParts(v.Translation).Contains(key)).ToList();
        if (verbs.Count == 0)
        {
            return null;
        }

        var related = candidates
            .SelectMany(v => v.Translation.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            .Where(gloss => gloss.Contains('(') && VerbBaseSearch.RussianParts(gloss[..gloss.IndexOf('(')]).Contains(key))
            .Distinct()
            .Take(MaxRelated)
            .ToList();
        return OfVerbs(VerbCardKind.Infinitive, key, verbs) with { Related = related };
    }

    private async Task<VerbTranslationCard?> ForActionNameAsync(string key, CancellationToken ct)
    {
        var verbs = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => v.Title == key)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Lemma)
            .Select(v => new VerbRow(v.Lemma, v.Title, v.Translation, v.Status, v.SortOrder, v.CardJson))
            .ToListAsync(ct);
        return verbs.Count == 0 ? null : OfVerbs(VerbCardKind.ActionName, key, verbs);
    }

    private static VerbTranslationCard OfVerbs(VerbCardKind kind, string key, IReadOnlyList<VerbRow> verbs) => new(
        kind,
        key,
        verbs.Take(MaxVerbs)
            .Select(v => new VerbCardVerb(v.Lemma, ActionNameOf(v.Lemma, v.Title), v.Translation, v.Status, KeyForms(v.CardJson)))
            .ToList(),
        Math.Max(0, verbs.Count - MaxVerbs));

    private async Task<VerbTranslationCard?> ForGeorgianFormAsync(string key, CancellationToken ct)
    {
        // Nothing is stated about an unverified form of a model-made verb — as in the parse line.
        var cells = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => f.Form == key && !f.Unverified)
            .Select(f => new
            {
                f.Verb.SortOrder, f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status,
                f.Tense, f.Person, f.Meaning, f.MeaningNote
            })
            .ToListAsync(ct);
        if (cells.Count == 0)
        {
            return null;
        }

        var verbs = cells
            .GroupBy(c => c.Lemma)
            .OrderBy(g => g.First().SortOrder)
            .ThenBy(g => g.Key)
            .Select(g => new VerbCardVerb(
                g.Key,
                ActionNameOf(g.Key, g.First().Title),
                g.First().Translation,
                g.First().Status,
                g.DistinctBy(c => (c.Tense, c.Person))
                    .OrderBy(c => VerbCardWording.Rank(c.Tense))
                    .ThenBy(c => c.Person)
                    .Take(MaxReadingsPerVerb)
                    .Select(c => new VerbCardLine(
                        [key], c.Tense, c.Person, c.Meaning, c.MeaningNote, VerbCardWording.Caption(c.Tense, c.Person)))
                    .ToList()))
            .ToList();
        return new VerbTranslationCard(VerbCardKind.Form, key, verbs.Take(MaxVerbs).ToList(), Math.Max(0, verbs.Count - MaxVerbs));
    }

    /// <summary>The title of a verb card is the name of the action — unless the base only repeats the dictionary form there.</summary>
    public static string? ActionNameOf(string lemma, string title) =>
        string.IsNullOrWhiteSpace(title) || title == lemma ? null : title;

    /// <summary>
    /// «я делаю», «он делает», «я сделаю», «я сделал» — the cells of the main table the base has, each
    /// with its stored phrase. The past is the one-off one; a verb that has only the long past gets that.
    /// </summary>
    public static IReadOnlyList<VerbCardLine> KeyForms(string cardJson)
    {
        // Tenses of a model-made verb that nothing confirms are not in "tenses" of the learner's card.
        var card = JsonNode.Parse(cardJson) is JsonObject parsed ? VerbVerification.ForLearners(parsed) : null;
        if (card?["tenses"] is not JsonObject tenses)
        {
            return [];
        }

        var past = tenses["aorist"] is JsonArray ? "aorist" : "imperfect";
        (string Tense, int Person)[] cells = [("present", 0), ("present", 2), ("future", 0), (past, 0)];
        var lines = new List<VerbCardLine>();
        foreach (var (tense, person) in cells)
        {
            var variants = (tenses[tense] as JsonArray)?.ElementAtOrDefault(person) is JsonArray cell
                ? cell.Select(f => f?.GetValue<string>()).Where(f => !string.IsNullOrEmpty(f)).Select(f => f!).ToList()
                : [];
            if (variants.Count == 0)
            {
                continue;
            }

            var meaning = (card["meanings"]?[tense] as JsonArray)?.ElementAtOrDefault(person)?.GetValue<string>();
            var note = card["meaningChips"]?[tense]?.GetValue<string>();
            lines.Add(new VerbCardLine(
                variants, tense, person, string.IsNullOrEmpty(meaning) ? null : meaning, note, VerbCardWording.Caption(tense, person)));
        }

        return lines;
    }
}
