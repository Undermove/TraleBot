using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Translation.Pipeline;

/// <param name="Outcome">
/// "replaced" — the new record is stored; "kept" — the old one stays, <paramref name="Reason"/> says why
/// ("not-approved", "fewer-tenses", "another-verb", "not-a-verb", "failed"); "not-found";
/// "not-model-made" — a curated verb or one taken from a source table: never touched;
/// "generation-is-off"; "over-budget".
/// </param>
/// <param name="MainTensesBefore">How many of the six main tenses the stored record had.</param>
/// <param name="MainTensesAfter">How many the newly written one has (also when it was not stored).</param>
/// <param name="ChangedForms">
/// Cells both records have, with different forms — "tense/person: old → new". A dictionary entry saved
/// with the old spelling no longer leads to the verb.
/// </param>
public record VerbRegenerationResult(
    string Outcome,
    string? Reason = null,
    int MainTensesBefore = 0,
    int MainTensesAfter = 0,
    IReadOnlyList<MissingTense>? Missing = null,
    IReadOnlyList<string>? ChangedForms = null,
    IReadOnlyList<string>? ReviewerReasons = null,
    double Seconds = 0);

/// <summary>
/// The owner's "rebuild this verb" action for a verb a model wrote: the generation runs again for it —
/// today's instructions, the completion round, the reviewer — and the stored record is replaced only
/// when the new one is approved, is the same verb and has at least as many main tenses (and cells) as
/// the old. Curated verbs and verbs taken from a source table are refused. The verb's row stays, so
/// learners keep their progress on it.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbRegenerationService(
    ITraleDbContext dbContext,
    VerbGenerationService generation,
    IVerbGenerationSwitch generationSwitch,
    RuntimeVerbStore store,
    IVerbLexicon lexicon,
    ModelBudget budget,
    ILogger<VerbRegenerationService> logger)
{
    public async Task<VerbRegenerationResult> ExecuteAsync(string lemma, CancellationToken ct)
    {
        var verb = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
        if (verb == null)
        {
            return new VerbRegenerationResult("not-found");
        }

        if (verb.Status != VerbStatus.Generated || !RuntimeVerbStore.IsRuntime(verb))
        {
            return new VerbRegenerationResult("not-model-made");
        }

        if (!generationSwitch.IsOn)
        {
            return new VerbRegenerationResult("generation-is-off");
        }

        var oldTenses = TensesOf(verb);
        var before = VerbCompleteness.Of(oldTenses);

        // A rebuild is a verb being written like any other: it takes a place in the day's generation budget.
        if (!await budget.TrySpendAsync(ModelSpend.Generation, ct))
        {
            return new VerbRegenerationResult("over-budget", MainTensesBefore: before.Tenses);
        }

        // Asked the way a learner would have asked: by the Russian infinitive the verb is stored under,
        // with the stored lemma as the hint — the reviewer then checks the verb against that gloss again.
        var infinitive = VerbProposalResolver.GlossParts(verb.Translation).FirstOrDefault();
        var request = infinitive == null
            ? new VerbGenerationRequest(lemma, IsRussian: false, Infinitive: null, LemmaHint: lemma, lexicon.Find(lemma))
            : new VerbGenerationRequest(infinitive, IsRussian: true, infinitive, LemmaHint: lemma, lexicon.FindByRussian(infinitive));

        var started = System.Diagnostics.Stopwatch.StartNew();
        VerbGenerationOutcome outcome;
        try
        {
            outcome = await generation.GenerateAsync(request, ct, preview: true);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Rebuilding verb {Lemma} failed: {Error}", lemma, GeorgianTranslationPipeline.Describe(e));
            return new VerbRegenerationResult("kept", "failed", before.Tenses, Seconds: started.Elapsed.TotalSeconds);
        }

        var draft = outcome.Draft;
        VerbRegenerationResult Kept(string reason) => new(
            "kept", reason, before.Tenses, draft == null ? 0 : VerbCompleteness.Of(draft.Paradigm.Tenses).Tenses,
            draft?.Missing, ReviewerReasons: draft?.Review.Reasons, Seconds: started.Elapsed.TotalSeconds);

        if (draft == null || outcome.Outcome != "approved" || outcome.Provenance == null)
        {
            return Kept(draft == null && outcome.Outcome is "not-a-verb" or "not-a-word" ? "not-a-verb" : "not-approved");
        }

        if (draft.Paradigm.Lemma != verb.Lemma)
        {
            return Kept("another-verb");
        }

        var after = VerbCompleteness.Of(draft.Paradigm.Tenses);
        if (after.Tenses < before.Tenses || (after.Tenses == before.Tenses && after.Cells < before.Cells))
        {
            return Kept("fewer-tenses");
        }

        // Every Russian word that led to the verb keeps leading to it: the stored glosses stay, the new ones are added.
        var translation = verb.Translation;
        foreach (var gloss in VerbProposalResolver.GlossParts(draft.Russian))
        {
            if (!VerbProposalResolver.GlossParts(translation).Contains(gloss)
                && $"{translation}, {gloss}".Length <= RuntimeVerbStore.MaxTranslationLength)
            {
                translation = $"{translation}, {gloss}";
            }
        }

        var changed = ChangedForms(oldTenses, draft.Paradigm.Tenses);
        outcome.Provenance.AskedText = (await dbContext.VerbProvenances.AsNoTracking()
            .Where(p => p.VerbId == verb.Id).Select(p => p.AskedText).FirstOrDefaultAsync(ct)) ?? outcome.Provenance.AskedText;
        var replaced = await store.ReplaceGeneratedAsync(
            verb, draft.Paradigm, translation, draft.Meanings, outcome.Provenance,
            VerbGenerationService.LacksTensesForGood(draft.Paradigm, draft.Missing), ct);
        if (!replaced)
        {
            return new VerbRegenerationResult("not-model-made");
        }

        logger.LogInformation(
            "Verb {Lemma} rebuilt: main tenses {Before} → {After}, changed cells {Changed}", lemma, before.Tenses, after.Tenses, changed.Count);
        return new VerbRegenerationResult(
            "replaced", null, before.Tenses, after.Tenses, draft.Missing, changed, draft.Review.Reasons, started.Elapsed.TotalSeconds);
    }

    private static Dictionary<string, string[][]> TensesOf(Verb verb) =>
        JsonNode.Parse(verb.CardJson)?["tenses"].Deserialize<Dictionary<string, string[][]>>() ?? new Dictionary<string, string[][]>();

    private static List<string> ChangedForms(
        IReadOnlyDictionary<string, string[][]> old, IReadOnlyDictionary<string, string[][]> now)
    {
        var changed = new List<string>();
        foreach (var (tense, row) in old)
        {
            for (var person = 0; person < row.Length; person++)
            {
                var was = row[person];
                var cell = now.TryGetValue(tense, out var newRow) && person < newRow.Length ? newRow[person] : [];
                if (was.Length > 0 && !was.Any(cell.Contains))
                {
                    changed.Add($"{tense}/{person}: {string.Join(" / ", was)} → {(cell.Length == 0 ? "—" : string.Join(" / ", cell))}");
                }
            }
        }

        return changed;
    }
}
