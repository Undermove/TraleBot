using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Entities;

namespace Application.Verbs;

/// <summary>One thing the owner did to a tense of a model-made verb — an element of <see cref="VerbProvenance.TenseReviewsJson"/>.</summary>
/// <param name="Action"><see cref="Confirmed"/>, <see cref="Edited"/> or <see cref="Removed"/>.</param>
/// <param name="By">The owner's Telegram id.</param>
/// <param name="Before">The six cells of the row before; null when there was no row.</param>
/// <param name="After">The six cells after; null when the row was removed.</param>
public record TenseReview(string Tense, string Action, long By, DateTime AtUtc, string?[]? Before, string?[]? After)
{
    public const string Confirmed = "confirmed";
    public const string Edited = "edited";
    public const string Removed = "removed";

    /// <summary>Not about one tense: the owner approved the whole verb / took that mark off. <see cref="Tense"/> is <see cref="WholeVerb"/>.</summary>
    public const string VerbApproved = "verb-approved";
    public const string VerbUnapproved = "verb-unapproved";
    public const string WholeVerb = "*";
}

/// <summary>
/// Which tenses of a model-made verb are "unverified": written by a model and confirmed by nothing
/// else. The one rule, used when a verb is stored, when an old record is brought up to date and when
/// the owner's list is built:
/// <list type="bullet">
/// <item>the present is the verb itself (its lemma is one of its cells; the hard gates and the reviewer
///   stand on it) — never unverified;</item>
/// <item>a row the owner confirmed or wrote by hand is verified;</item>
/// <item>a row the owner once removed and a later rebuild brought back is unverified, whatever the texts say;</item>
/// <item>any other row is unverified when fewer than half of its forms occur in the corpora of real
///   texts — the same bar a row of the completion round has to clear to be taken at all. On catalog
///   verbs, whose forms are known to be right, every future, aorist and optative form clears it and
///   three conditional forms in four;</item>
/// <item>with no corpus data loaded nothing can be judged: rows count as verified (the shipped build
///   always has the data).</item>
/// </list>
/// Curated verbs and verbs taken from a source table are not looked at: they are verified.
/// </summary>
public static class VerbVerification
{
    /// <summary>The card's property with the unverified tenses, in the card's order.</summary>
    public const string CardProperty = "unverifiedTenses";

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static IReadOnlyList<string> UnverifiedTenses(
        IReadOnlyDictionary<string, string[][]> tenses, IVerbLexicon lexicon, IReadOnlyList<TenseReview>? reviews = null)
    {
        var last = (reviews ?? []).GroupBy(r => r.Tense).ToDictionary(g => g.Key, g => g.Last().Action);
        return VerbAnalyzer.KnownTenses
            .Where(t => t != "present" && tenses.TryGetValue(t, out var row) && row.Any(cell => cell.Length > 0))
            .Where(t => last.GetValueOrDefault(t) switch
            {
                TenseReview.Confirmed or TenseReview.Edited => false,
                TenseReview.Removed => true,
                _ => !ConfirmedByTexts(tenses[t].SelectMany(cell => cell), lexicon)
            })
            .ToList();
    }

    /// <summary>At least half of the forms occur in real texts (or there is no corpus data to ask).</summary>
    public static bool ConfirmedByTexts(IEnumerable<string> forms, IVerbLexicon lexicon)
    {
        var all = forms.Distinct().ToList();
        return !lexicon.HasAttestedForms || all.Count(lexicon.IsAttested) * 2 >= all.Count;
    }

    public static IReadOnlyList<TenseReview> Reviews(string? tenseReviewsJson) =>
        string.IsNullOrWhiteSpace(tenseReviewsJson) ? [] : JsonSerializer.Deserialize<List<TenseReview>>(tenseReviewsJson, Json) ?? [];

    public static string Serialize(IEnumerable<TenseReview> reviews) => JsonSerializer.Serialize(
        reviews, new JsonSerializerOptions(Json) { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    /// <summary>The unverified tenses a stored card names; empty for a card that has none or predates the property.</summary>
    public static IReadOnlyList<string> Of(JsonNode? card) =>
        (card?[CardProperty] as JsonArray)?.Select(t => t!.GetValue<string>()).ToList() ?? [];

    public static IReadOnlyList<string> Of(string cardJson) => Of(JsonNode.Parse(cardJson));

    /// <summary>
    /// The card as a learner gets it: unverified rows are moved out of <c>tenses</c> (and their phrases
    /// out of <c>meanings</c>) into <c>unverified</c> / <c>unverifiedMeanings</c>. Everything that
    /// teaches or examines reads <c>tenses</c>, so it cannot pick such a row up; only the table of the
    /// card shows them, marked.
    /// </summary>
    public static JsonObject ForLearners(JsonObject card)
    {
        var unverified = Of(card);
        card.Remove(CardProperty);
        if (unverified.Count == 0 || card["tenses"] is not JsonObject tenses)
        {
            return card;
        }

        var rows = new JsonObject();
        var phrases = new JsonObject();
        foreach (var tense in unverified)
        {
            if (tenses[tense] is { } row)
            {
                tenses.Remove(tense);
                rows[tense] = row;
            }

            if (card["meanings"] is JsonObject meanings && meanings[tense] is { } meaning)
            {
                meanings.Remove(tense);
                phrases[tense] = meaning;
            }

            (card["meaningChips"] as JsonObject)?.Remove(tense);
        }

        // The odd-tense list drives highlighting of rows of the table: only rows that are still there.
        if (card["oddTenses"] is JsonArray odd)
        {
            card["oddTenses"] = new JsonArray(odd.Select(t => t!.GetValue<string>()).Where(t => !unverified.Contains(t)).Select(t => (JsonNode)t).ToArray());
        }

        card["unverified"] = rows;
        card["unverifiedMeanings"] = phrases;
        return card;
    }
}
