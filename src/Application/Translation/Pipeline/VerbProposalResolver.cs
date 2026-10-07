using System.Text.RegularExpressions;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Translation.Pipeline;

/// <param name="Form">The Georgian form of the verb that answers the looked-up text; null when only the verb is known.</param>
/// <param name="Path">"existing" | "wiktionary" | "generated" — for the request log.</param>
public record ResolvedVerb(Verb Verb, string? Form, string Path);

/// <param name="Rejection">Why the proposal did not hold — a short fixed code for the request log, no user text.</param>
/// <param name="RetryHint">
/// When the rejection is a concrete disagreement with the data that the model can fix — what to tell it.
/// The caller may send the question back once with this text; never more than once.
/// </param>
/// <param name="LemmaHint">The lemma the analyst named, when it is a Georgian word — a hint for the generator.</param>
/// <param name="CanGenerate">
/// False when the analyst pointed at a verb the base already has and the proposal failed for that verb's
/// own reasons: there is nothing for the generator to write.
/// </param>
public record VerbResolution(
    ResolvedVerb? Verb, string? Rejection, string? RetryHint = null, string? LemmaHint = null, bool CanGenerate = true)
{
    public static VerbResolution Rejected(string reason, string? retryHint = null) => new(null, reason, retryHint);
}

/// <summary>
/// Step 3 of the agent path: validates the analyst's proposal and stores the verb.
/// <para>
/// The trust rule. A model gets Georgian morphology wrong some of the time, and a wrong form stored
/// here stays wrong for every later user. So the analyst only chooses a Wiktionary page; the paradigm
/// itself is read from the page by our own code. When the source has no table nothing is stored here:
/// the proposal is rejected with the lemma as a hint, and the pipeline hands the verb to
/// <see cref="VerbGenerationService"/> (a strong model writes the record, a second one approves it).
/// </para>
/// <para>
/// What counts as the same verb. For a Russian word: a verb of the base whose Russian gloss lists
/// exactly that infinitive. A near-synonym is another verb («сказать» is not «говорить, разговаривать»),
/// so a proposal that points a Russian word at a catalog verb with a different gloss is rejected. For
/// a Georgian word: a verb that really has that form (or the form the analyst read a typo as).
/// </para>
/// <para>
/// Self-check against open data (<see cref="IVerbLexicon"/>), run here on every proposal whether or not
/// the model used its lookup tools: the lemma must be a verb the Wiktionary lexicon knows or one whose
/// forms occur in real texts; when the lexicon translates the asked Russian word with other verbs, the
/// proposal must be one of them; the Russian gloss and the verbal noun are taken from the source when it
/// has them.
/// </para>
/// </summary>
public class VerbProposalResolver(
    ITraleDbContext dbContext,
    RuntimeVerbStore store,
    IWiktionaryVerbSource wiktionary,
    IVerbLexicon lexicon)
{
    /// <summary>A dropped, doubled or swapped letter or two — beyond that it is another word.</summary>
    private const int MaxTypoEdits = 2;

    private const int MaxGlosses = 3;

    private static readonly Regex GeorgianWords = new("[ა-ჰ]+", RegexOptions.Compiled);

    /// <summary>
    /// One Russian gloss: a dictionary infinitive, optionally with a complement or a clarification in
    /// brackets — «облегчать», «быть голодным», «иметь (кого-то)». Anything else (a noun, a finite
    /// form, Latin, Georgian) is not a verb gloss.
    /// </summary>
    private static readonly Regex Infinitive = new(
        @"^[а-яё]+(ть|ти|чь)(ся|сь)?( [а-яё -]{1,30})?( \([а-яё -]{1,30}\))?$", RegexOptions.Compiled);

    /// <returns>The stored verb, or the reason the proposal was rejected — the caller falls back to plain translation.</returns>
    /// <param name="sourceTimeout">Bounds a Wiktionary request made here; database writes use <paramref name="ct"/> only.</param>
    public async Task<VerbResolution> ResolveAsync(
        VerbQuestion question, VerbAnalystResult result, CancellationToken sourceTimeout, CancellationToken ct)
    {
        var proposal = result.Proposal;
        if (proposal.Outcome == VerbProposalOutcome.None)
        {
            return VerbResolution.Rejected("analyst-found-no-verb");
        }

        var lemma = proposal.Lemma?.Trim();
        if (!IsGeorgianWord(lemma))
        {
            return VerbResolution.Rejected("lemma-not-georgian");
        }

        var askedWords = question.IsRussian ? [] : GeorgianWords.Matches(question.Text).Select(m => m.Value).ToList();
        // "You meant this form" holds only for a form that is a typo away from what was typed: the
        // model may not explain an arbitrary string with a form it happens to contain.
        var proposedForm = IsGeorgianWord(proposal.Form?.Trim()) && askedWords.Any(w => EditDistance(w, proposal.Form!.Trim()) <= MaxTypoEdits)
            ? proposal.Form!.Trim()
            : null;
        var askedInfinitive = question.IsRussian ? NormalizeGloss(question.Text) : null;

        // The lexicon's word against the model's: when the source translates the asked Russian verb
        // with certain verbs, a proposal outside that list is a near-synonym at best.
        if (askedInfinitive != null)
        {
            var sourced = lexicon.FindByRussian(askedInfinitive);
            if (sourced.Count > 0 && sourced.All(v => v.Lemma != lemma))
            {
                return VerbResolution.Rejected(
                    "lexicon-translates-the-word-with-another-verb",
                    $"The Wiktionary lexicon translates «{askedInfinitive}» with: {string.Join(", ", sourced.Select(v => v.Lemma))}. " +
                    $"You proposed {lemma}. Answer again with one of the listed lemmas, or with outcome \"none\".");
            }
        }

        // Whatever the analyst calls it, a verb that is already stored is served as stored.
        var existing = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        if (existing != null)
        {
            return await ResolveExistingAsync(existing, askedInfinitive, askedWords, proposedForm, ct);
        }

        if (proposal.Outcome == VerbProposalOutcome.Existing)
        {
            return VerbResolution.Rejected("claimed-verb-not-in-base") with { LemmaHint = lemma };
        }

        var known = lexicon.Find(lemma!).FirstOrDefault(v => v.Lemma == lemma);

        // The gloss comes from the source when it has one; the model's own is the fallback.
        var fromSource = known is { Russian.Count: > 0 };
        var glosses = Glosses(askedInfinitive, fromSource ? $"{string.Join(", ", known!.Russian)}, {proposal.Russian}" : proposal.Russian);
        // The page is looked at by us even if the analyst never asked for it: a table in the source
        // always beats the model's own forms.
        if (!result.FetchedPages.TryGetValue(lemma!, out var page))
        {
            page = await wiktionary.FetchAsync(lemma!, sourceTimeout);
        }

        if (page == null)
        {
            return VerbResolution.Rejected("no-table-in-the-source") with { LemmaHint = lemma };
        }

        if (glosses == null)
        {
            // The source has the table; only the analyst's Russian is unusable — it is asked once more.
            // A verb that has a table is never handed to the generator.
            return VerbResolution.Rejected(
                "russian-gloss-not-an-infinitive",
                $"\"russian\" for {lemma} must be the verb's dictionary infinitive(s) in Russian (like «делать», «быть голодным»), " +
                $"not a finite form, a noun or a phrase. You wrote: «{proposal.Russian}». Answer again with the same lemma.") with
            {
                CanGenerate = false
            };
        }

        // A verb's identity is its present "he/she" form — true of every catalog verb. Wiktionary
        // also has pages titled by another form (a future with a preverb) that carry a table; the
        // catalog build rejects those, and so must we, or one verb gets stored under two lemmas.
        if (!page.Paradigm.Tenses.TryGetValue("present", out var present)
            || present.Length != 6
            || !present[2].Contains(lemma))
        {
            return VerbResolution.Rejected("page-is-not-the-present-form");
        }

        var paradigm = page.Paradigm;
        var note = "Формы — из таблицы спряжения в Викисловаре. " + (fromSource
            ? "Перевод сверен с русским Викисловарём."
            : "Перевод подобрала нейросеть по английскому толкованию из Викисловаря.");

        // A Georgian word the user sent must be this verb, or the analyst must name the form it took
        // the word for (a typo) — otherwise the proposal is about some other verb.
        var matched = askedWords.FirstOrDefault(paradigm.Contains)
                      ?? (proposedForm != null && paradigm.Contains(proposedForm) ? proposedForm : null);
        if (askedWords.Count > 0 && matched == null)
        {
            return VerbResolution.Rejected("word-is-not-a-form-of-the-proposed-verb");
        }

        var verb = await store.AddAsync(paradigm, glosses, VerbStatus.Verified, ct, note);
        return new VerbResolution(new ResolvedVerb(verb, matched, "wiktionary"), null);
    }

    private async Task<VerbResolution> ResolveExistingAsync(
        Verb existing, string? askedInfinitive, List<string> askedWords, string? proposedForm, CancellationToken ct)
    {
        if (askedInfinitive != null)
        {
            // The same verb: its gloss in the base lists the infinitive, or the open lexicon does.
            var sourced = lexicon.FindByRussian(askedInfinitive).Any(v => v.Lemma == existing.Lemma);
            if (!sourced && !GlossParts(existing.Translation).Contains(askedInfinitive))
            {
                // A curated gloss is the definition of the verb: another Russian word is another verb.
                // The gloss of a runtime verb was written by a model for the first word that led to it,
                // so the same model naming the same verb for one more word only completes it.
                if (!RuntimeVerbStore.IsRuntime(existing))
                {
                    return VerbResolution.Rejected("catalog-verb-has-another-russian-gloss") with { CanGenerate = false };
                }

                await store.AddGlossAsync(existing, askedInfinitive, ct);
            }

            return new VerbResolution(new ResolvedVerb(existing, null, "existing"), null);
        }

        var known = await dbContext.VerbForms
            .Where(f => f.VerbId == existing.Id && (askedWords.Contains(f.Form) || f.Form == proposedForm))
            .Select(f => f.Form)
            .ToListAsync(ct);
        var form = askedWords.FirstOrDefault(known.Contains) ?? (known.Contains(proposedForm!) ? proposedForm : null);
        // Same rule as for a new verb: a Georgian word must be tied to the verb by a real form.
        if (askedWords.Count > 0 && form == null && !askedWords.Contains(existing.Title))
        {
            return VerbResolution.Rejected("word-is-not-a-form-of-the-proposed-verb");
        }

        return new VerbResolution(new ResolvedVerb(existing, form, "existing"), null);
    }

    /// <summary>«Есть, Кушать» → «есть», «кушать»; a clarification in brackets is part of its gloss.</summary>
    public static IReadOnlyList<string> GlossParts(string translation) =>
        translation.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(NormalizeGloss)
            .ToList();

    internal static string NormalizeGloss(string gloss) => gloss.Trim().ToLowerInvariant().Replace('ё', 'е');

    /// <summary>
    /// The gloss to store: the infinitive the user asked about first (so the next request for it finds
    /// the verb), then what the model wrote. Null when nothing in it is a dictionary infinitive.
    /// </summary>
    internal static string? Glosses(string? askedInfinitive, string? proposed)
    {
        var parts = new List<string>();
        if (askedInfinitive != null)
        {
            parts.Add(askedInfinitive);
        }

        parts.AddRange(GlossParts(proposed ?? string.Empty));
        var glosses = parts.Where(p => Infinitive.IsMatch(p)).Distinct().Take(MaxGlosses).ToList();
        return glosses.Count == 0 ? null : string.Join(", ", glosses);
    }

    private static int EditDistance(string a, string b)
    {
        var previous = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++)
        {
            var current = new int[b.Length + 1];
            current[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                current[j] = Math.Min(Math.Min(current[j - 1], previous[j]) + 1, previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
            }

            previous = current;
        }

        return previous[b.Length];
    }

    private static bool IsGeorgianWord(string? value) =>
        value is { Length: > 0 and <= VerbParadigm.MaxFormLength } && VerbParadigm.GeorgianWord.IsMatch(value.Trim());
}
