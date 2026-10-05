using System.Text.RegularExpressions;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Translation.Pipeline;

/// <param name="Form">The Georgian form of the verb that answers the looked-up text; null when only the verb is known.</param>
/// <param name="Path">"existing" | "wiktionary" | "generated" — for the request log.</param>
public record ResolvedVerb(Verb Verb, string? Form, string Path);

/// <summary>
/// Step 3 of the agent path: validates the analyst's proposal and stores the verb.
/// <para>
/// The trust rule. A model gets Georgian morphology wrong some of the time, and a wrong form stored
/// here stays wrong for every later user. So the model only chooses: which verb of the base, or which
/// Wiktionary page. The paradigm itself is read from the page by our own code. Only when the source
/// has no table may the model's forms be stored — as <see cref="VerbStatus.Generated"/>, which the
/// card shows as «не проверено» and which games and SEO must skip.
/// </para>
/// </summary>
public class VerbProposalResolver(
    ITraleDbContext dbContext,
    RuntimeVerbStore store,
    IWiktionaryVerbSource wiktionary,
    IOptions<TranslationAgentOptions> options)
{
    private static readonly Regex GeorgianWords = new("[ა-ჰ]+", RegexOptions.Compiled);

    /// <summary>A Russian gloss: Cyrillic words with commas, hyphens and brackets — nothing else.</summary>
    private static readonly Regex RussianGloss = new(@"^[а-яё][а-яё ,()\-]{0,78}[а-яё)]$", RegexOptions.Compiled);

    /// <param name="key">The normalised looked-up text.</param>
    /// <param name="sourceTimeout">Bounds a Wiktionary request made here; database writes use <paramref name="ct"/> only.</param>
    /// <returns>Null when the proposal does not hold — the caller falls back to plain translation.</returns>
    public async Task<ResolvedVerb?> ResolveAsync(
        string key, VerbAnalystResult result, CancellationToken sourceTimeout, CancellationToken ct)
    {
        var proposal = result.Proposal;
        var lemma = proposal.Lemma?.Trim();
        if (proposal.Outcome == VerbProposalOutcome.None || !IsGeorgianWord(lemma))
        {
            return null;
        }

        var askedWords = GeorgianWords.Matches(key).Select(m => m.Value).ToList();
        var proposedForm = IsGeorgianWord(proposal.Form?.Trim()) ? proposal.Form!.Trim() : null;

        // Whatever the analyst calls it, a verb that is already stored is served as stored.
        var existing = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        if (existing != null)
        {
            var known = await dbContext.VerbForms
                .Where(f => f.VerbId == existing.Id && (askedWords.Contains(f.Form) || f.Form == proposedForm))
                .Select(f => f.Form)
                .ToListAsync(ct);
            var form = askedWords.FirstOrDefault(known.Contains) ?? (known.Contains(proposedForm!) ? proposedForm : null);
            // Same rule as for a new verb below: a Georgian word must be tied to the verb by a real form.
            if (askedWords.Count > 0 && form == null && !askedWords.Contains(existing.Title))
            {
                return null;
            }

            return new ResolvedVerb(existing, form, "existing");
        }

        if (proposal.Outcome == VerbProposalOutcome.Existing)
        {
            return null;
        }

        var russian = proposal.Russian?.Trim().ToLowerInvariant();
        if (russian == null || !RussianGloss.IsMatch(russian))
        {
            return null;
        }

        // The page is looked at by us even if the analyst never asked for it: a table in the source
        // always beats the model's own forms.
        if (!result.FetchedPages.TryGetValue(lemma!, out var page))
        {
            page = await wiktionary.FetchAsync(lemma!, sourceTimeout);
        }

        VerbParadigm paradigm;
        VerbStatus status;
        if (page != null)
        {
            paradigm = page.Paradigm;
            status = VerbStatus.Verified;
        }
        else if (proposal.Outcome == VerbProposalOutcome.Generated && options.Value.AllowGeneratedVerbs)
        {
            var generated = GeneratedParadigm(lemma!, proposal);
            if (generated == null)
            {
                return null;
            }

            paradigm = generated;
            status = VerbStatus.Generated;
        }
        else
        {
            return null;
        }

        // A Georgian word the user sent must be this verb, or the analyst must name the form it took
        // the word for (a typo) — otherwise the proposal is about some other verb.
        var matched = askedWords.FirstOrDefault(paradigm.Contains)
                      ?? (proposedForm != null && paradigm.Contains(proposedForm) ? proposedForm : null);
        if (askedWords.Count > 0 && matched == null)
        {
            return null;
        }

        var verb = await store.AddAsync(paradigm, russian, status, ct);
        return new ResolvedVerb(verb, matched, status == VerbStatus.Verified ? "wiktionary" : "generated");
    }

    /// <summary>The model's forms as a paradigm, or null when they do not have the shape of one.</summary>
    private static VerbParadigm? GeneratedParadigm(string lemma, VerbProposal proposal)
    {
        var tenses = proposal.GeneratedTenses;
        if (tenses == null || !tenses.ContainsKey("present"))
        {
            return null;
        }

        var result = new Dictionary<string, string[][]>();
        foreach (var (tense, persons) in tenses)
        {
            if (persons == null || persons.Length == 0)
            {
                continue;
            }

            // Six persons, each one Georgian word in Georgian script: a model that answers in Latin
            // transliteration or with a sentence is rejected whole, not patched up.
            if (!VerbAnalyzer.CardTenses.Contains(tense) || persons.Length != 6 || !persons.All(IsGeorgianWord))
            {
                return null;
            }

            result[tense] = persons.Select(form => new[] { form.Trim() }).ToArray();
        }

        // The lemma is by definition the "he/she" form of the present.
        if (!result.TryGetValue("present", out var present) || present[2][0] != lemma)
        {
            return null;
        }

        var masdar = IsGeorgianWord(proposal.GeneratedMasdar?.Trim()) ? new[] { proposal.GeneratedMasdar!.Trim() } : [];
        return new VerbParadigm(lemma, masdar, result, [], Source: null, Revid: null);
    }

    private static bool IsGeorgianWord(string? value) =>
        value is { Length: > 0 and <= VerbParadigm.MaxFormLength } && VerbParadigm.GeorgianWord.IsMatch(value.Trim());
}
