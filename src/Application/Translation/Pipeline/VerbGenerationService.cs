using System.Text.RegularExpressions;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Application.Translation.Pipeline;

/// <param name="Verb">The stored verb; null when nothing was stored.</param>
/// <param name="Outcome">
/// "stored" | "existing" | "not-a-verb" | "not-a-word" | "rejected" — for the request log; with
/// <paramref name="Reason"/> a short fixed code, no user text.
/// </param>
/// <param name="Draft">The last record that reached the reviewer, with its verdict — for a preview and for reports.</param>
/// <param name="SourceTable">
/// Outcome "has-table": the generator named a verb the source does have a conjugation table for (the
/// cheap agent had missed it). Its lemma and Russian gloss — the caller stores the verb from the table.
/// </param>
/// <param name="CompletionRounds">1 when the generator was asked once more for missing main tenses; else 0.</param>
/// <param name="Provenance">For an approved record: its provenance row (saved with the verb unless this was a preview).</param>
/// <param name="DroppedRows">How many rows the reviewer rejected and the record was stored without.</param>
public record VerbGenerationOutcome(
    ResolvedVerb? Verb, string Outcome, string? Reason, ModelUsage Generator, ModelUsage Reviewer, int RepairRounds,
    VerbGenerationDraft? Draft = null, VerbProposal? SourceTable = null, int CompletionRounds = 0, VerbProvenance? Provenance = null,
    int DroppedRows = 0)
{
    public bool NotAWord => Outcome == "not-a-word";
}

/// <summary>A record as it was shown to the reviewer, and what the reviewer said.</summary>
/// <param name="Missing">Main tenses the record does not have, and why.</param>
/// <param name="Completed">Main tenses that were added on the completion round.</param>
public record VerbGenerationDraft(
    VerbParadigm Paradigm, string Russian, VerbMeanings Meanings, VerbEvidence Evidence, VerbReview Review,
    IReadOnlyList<MissingTense> Missing, IReadOnlyList<string> Completed);

/// <summary>
/// The last step of the verb path: a verb that is in neither the base nor a Wiktionary table is written
/// out in full by the strong model, checked by our code, approved by a second model and stored.
/// <para>
/// Who decides what. The generator writes the record by explicit rules. Our code holds the hard gates —
/// things that are not a matter of opinion: Georgian script only, six cells per row, the lemma is the
/// "he/she" form of the present, the Georgian word the user typed is one of the forms, the Russian
/// forms have the shape the phrase builder needs. The classification of the verb (pattern, root, odd
/// tenses) is computed by <see cref="VerbAnalyzer"/>, never asked from a model. Everything that is a
/// judgement — is the paradigm consistent, is this lemma the verb for that Russian word, is the text
/// that form — is the reviewer's, and it is given our evidence to judge with: the open lexicon's entry
/// and how many forms occur in real texts. The lexicon and the corpora are evidence here, not gates.
/// </para>
/// <para>
/// A learner needs all six main tenses, and a cautious model leaves out the ones that do not follow the
/// usual scheme. So a record that passed the gates with a main tense missing is not shown to the
/// reviewer yet: the generator is asked once more, for exactly those tenses (the completion round), and
/// answers each with the forms, or with "this verb has no such tense" and a reason, or with neither.
/// What it gave is merged into the record; what is still missing is stored with the provenance
/// together with the reason. One such round per verb, never a second, and never after the reviewer has
/// spoken. Forms that came only on that second ask are the least certain ones in the record, so they
/// need two confirmations: a row is taken only when real texts have at least half of its forms, and it
/// is stored only if the reviewer does not reject it.
/// </para>
/// <para>
/// A record must not be lost because it tried to be complete. When the reviewer rejects whole rows and
/// vouches for the rest, the record is stored without those rows — at once for rows of the completion
/// round, after the repair round for rows of the first pass.
/// </para>
/// <para>
/// At most one repair round: what the gates or the reviewer named goes back to the generator once.
/// After that the record is approved or dropped — nothing is stored and the caller translates the
/// plain way. The whole of it — up to three calls of the generator and two of the reviewer — has one
/// deadline (<see cref="TranslationAgentOptions.GenerationTotalSeconds"/>).
/// </para>
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbGenerationService(
    ITraleDbContext dbContext,
    RuntimeVerbStore store,
    IVerbGenerator generator,
    IVerbReviewer reviewer,
    IVerbLexicon lexicon,
    IOptions<TranslationAgentOptions> options,
    ILogger<VerbGenerationService> logger)
{
    private const int MaxReasons = 8;
    private const int MaxReasonLength = 300;

    /// <summary>The completion round is not started with less than this left for it before the reviewer's share of the deadline.</summary>
    private const int MinSecondsForCompletion = 15;

    private static readonly Regex GeorgianWords = new("[ა-ჰ]+", RegexOptions.Compiled);

    private static readonly System.Text.Json.JsonSerializerOptions Json = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
    };

    /// <summary>The six tenses of the card except the present, which a record cannot be without.</summary>
    private static readonly IReadOnlyList<string> MainTensesAfterPresent =
        VerbAnalyzer.CardTenses.Where(t => t != "present").ToList();

    /// <param name="request">What was asked, with the cheap agent's hint and the lexicon's candidates.</param>
    /// <param name="preview">
    /// True: write and review only — nothing is stored and what the base already has is not looked at.
    /// The outcome is then "approved" instead of "stored". For comparing models and for reports.
    /// </param>
    public async Task<VerbGenerationOutcome> GenerateAsync(VerbGenerationRequest request, CancellationToken ct, bool preview = false)
    {
        var generatorUsage = ModelUsage.None;
        var reviewerUsage = ModelUsage.None;
        var askedWords = request.IsRussian ? [] : GeorgianWords.Matches(request.Text).Select(m => m.Value).ToList();
        var askedInfinitive = request.IsRussian ? VerbProposalResolver.NormalizeGloss(request.Infinitive ?? request.Text) : null;

        VerbGenerationDraft? lastDraft = null;
        var completionRounds = 0;
        var droppedRows = 0;
        var reviewed = false;
        VerbGenerationOutcome Done(ResolvedVerb? verb, string outcome, string? reason, int rounds) =>
            new(verb, outcome, reason, generatorUsage, reviewerUsage, rounds, lastDraft, CompletionRounds: completionRounds, DroppedRows: droppedRows);

        // One deadline for everything below: a step gets its own timeout or what is left, whichever is less.
        var started = System.Diagnostics.Stopwatch.StartNew();
        int Left() => options.Value.GenerationTotalSeconds - (int)started.Elapsed.TotalSeconds;
        CancellationTokenSource Within(int seconds) => Timeout(Math.Min(seconds, Left()), ct);

        // What the completion round said, kept across the repair round: tense → the reason the
        // generator gave for "this verb has no such tense", and the tenses it added.
        var declaredAbsent = new Dictionary<string, string?>();
        var unsureNotes = new Dictionary<string, string?>();
        var completed = new List<string>();

        // The record as the reviewer is shown it: what is missing and why, the phrases, the match, the evidence.
        (IReadOnlyList<MissingTense> Missing, List<string> Added, VerbMeanings Meanings, (string Form, string Tense, int Person)? Matched, VerbEvidence Evidence)
            Assemble(VerbParadigm draft, GeneratedVerb written) => (
                MissingMainTenses(draft.Tenses)
                    .Select(t => declaredAbsent.TryGetValue(t, out var reason)
                        ? new MissingTense(t, MissingTense.VerbLacksIt, reason)
                        : new MissingTense(t, MissingTense.NotSure, unsureNotes.GetValueOrDefault(t)))
                    .ToList(),
                completed.Where(draft.Tenses.ContainsKey).ToList(),
                VerbMeaningBuilder.Build(written.RussianForms!, draft.Tenses.Keys.ToList()),
                Matched(draft, written, askedWords),
                Evidence(draft, askedInfinitive));

        static VerbGenerationDraft DraftOf(
            VerbParadigm draft,
            string glosses,
            (IReadOnlyList<MissingTense> Missing, List<string> Added, VerbMeanings Meanings, (string Form, string Tense, int Person)? Matched, VerbEvidence Evidence) shown,
            VerbReview review)
        {
            var disputed = review.MissingTenses ?? [];
            return new VerbGenerationDraft(
                draft, glosses, shown.Meanings, shown.Evidence, review,
                shown.Missing.Select(m => m with { ReviewerDisagrees = disputed.Contains(m.Tense) }).ToList(), shown.Added);
        }

        if (askedInfinitive != null && !preview)
        {
            // The lexicon translates the asked word with a verb that is already stored (it got there for
            // another Russian word): nothing to write, and no model to ask — unless the cheap agent named
            // another of the lexicon's verbs («учить» is both "to teach" and "to learn").
            var sourced = request.Lexicon.Select(v => v.Lemma).ToList();
            var stored = await dbContext.Verbs.Where(v => sourced.Contains(v.Lemma)).ToListAsync(ct);
            if (stored.Count == 1 && (request.LemmaHint == null || request.LemmaHint == stored[0].Lemma))
            {
                return await ExistingAsync(stored[0], askedInfinitive, askedWords, Done, 0, ct, sourcedByLexicon: true);
            }
        }

        var ask = request;
        for (var round = 0; ; round++)
        {
            GeneratedVerb written;
            using (var timeout = Within(options.Value.GeneratorTimeoutSeconds))
            {
                written = await generator.GenerateAsync(ask, timeout.Token);
            }

            generatorUsage += written.Usage ?? ModelUsage.None;
            if (written.Verdict != GeneratedVerbVerdict.Verb)
            {
                return Done(null, written.Verdict == GeneratedVerbVerdict.NotAWord ? "not-a-word" : "not-a-verb", null, round);
            }

            var lemma = written.Lemma?.Trim();
            var problems = new List<string>();
            var draft = lemma == null ? null : Draft(lemma, written, askedWords, problems);

            // A verb that is already stored is served as stored — it was checked when it got there.
            if (!preview && lemma != null && VerbParadigm.GeorgianWord.IsMatch(lemma))
            {
                var existing = await dbContext.Verbs.FirstOrDefaultAsync(v => v.Lemma == lemma, ct);
                if (existing != null)
                {
                    return await ExistingAsync(existing, askedInfinitive, askedWords, Done, round, ct);
                }
            }

            // The source's table always beats a model's forms: when the open lexicon says this lemma has
            // one, nothing the generator wrote is stored — only its choice of the verb and its gloss are used.
            if (!preview && lemma != null && lexicon.Find(lemma).Any(v => v.Lemma == lemma && v.HasTable))
            {
                return Done(null, "has-table", null, round) with
                {
                    SourceTable = new VerbProposal(VerbProposalOutcome.Wiktionary, lemma, written.Russian)
                };
            }

            string? glosses = null;
            if (draft != null)
            {
                glosses = VerbProposalResolver.Glosses(askedInfinitive, written.Russian);
                if (glosses == null)
                {
                    problems.Add("\"russian\" must be the dictionary infinitive(s) of the verb in Russian, Cyrillic, comma-separated");
                }
            }

            // The completion round: once per verb, only for a record that is otherwise sound, and only
            // before the reviewer has seen it — a row taken out on the reviewer's word is not asked for again.
            if (draft != null && glosses != null && problems.Count == 0 && completionRounds == 0 && !reviewed
                && options.Value.CompleteMissingTenses
                && MissingMainTenses(draft.Tenses) is { Count: > 0 } absent
                && Left() - options.Value.ReviewerTimeoutSeconds >= MinSecondsForCompletion)
            {
                completionRounds = 1;
                var completion = await CompleteAsync(request, written, absent, Within(options.Value.CompletionTimeoutSeconds), ct);
                generatorUsage += completion?.Usage ?? ModelUsage.None;
                (written, draft) = Merge(lemma!, written, draft, askedWords, completion, absent, declaredAbsent, unsureNotes, completed);
            }

            VerbReview? review = null;
            if (draft != null && glosses != null && problems.Count == 0)
            {
                var shown = Assemble(draft, written);
                using (var timeout = Within(options.Value.ReviewerTimeoutSeconds))
                {
                    review = await reviewer.ReviewAsync(
                        new VerbReviewRequest(
                            request.Text, request.IsRussian, askedInfinitive, draft.Lemma, draft.Masdar.FirstOrDefault(), glosses,
                            draft.Tenses, shown.Meanings.Meanings, shown.Matched?.Form, shown.Matched?.Tense, shown.Matched?.Person,
                            shown.Evidence, shown.Missing, shown.Added),
                        timeout.Token);
                }

                reviewed = true;
                reviewerUsage += review.Usage ?? ModelUsage.None;
                lastDraft = DraftOf(draft, glosses, shown, review);

                // Rejected for whole rows only, with the rest of the record right: those rows are left
                // out and the rest is what the reviewer approved. Rows of the first pass get the repair
                // round first; rows of the completion round, and any row on the last round, do not.
                if (!review.Approved
                    && RowsToSetAside(review, draft, completed, lastRound: round >= 1) is { } aside
                    && Without(lemma!, written, aside, askedWords) is var (reducedWritten, reducedDraft))
                {
                    foreach (var tense in aside)
                    {
                        declaredAbsent.Remove(tense);
                        unsureNotes[tense] = "the reviewer rejected the row the generator gave";
                    }

                    logger.LogInformation("Generated verb {Lemma}: rows left out on the reviewer's word: {Tenses}", lemma, string.Join(", ", aside));
                    (written, draft, droppedRows) = (reducedWritten, reducedDraft, aside.Count);
                    shown = Assemble(draft, written);
                    review = review with { Approved = true };
                    lastDraft = DraftOf(draft, glosses, shown, review);
                }

                if (review.Approved)
                {
                    var provenance = Provenance(request.Text, round, shown.Evidence, review, lastDraft.Missing, shown.Added);
                    if (preview)
                    {
                        return Done(null, "approved", null, round) with { Provenance = provenance };
                    }

                    var verb = await store.AddAsync(
                        draft, glosses, VerbStatus.Generated, ct, verification: null, shown.Meanings, provenance,
                        lacksTenses: LacksTensesForGood(draft, lastDraft.Missing));
                    return Done(new ResolvedVerb(verb, shown.Matched?.Form, "generated"), "stored", null, round) with { Provenance = provenance };
                }

                problems.AddRange(review.Reasons);
            }

            // Reasons are logged as written by the model — they are about a verb, not about the user;
            // the looked-up text itself is not in this line.
            logger.LogInformation(
                "Generated verb {Lemma} sent back (round {Round}, by {By}): {Problems}",
                lemma, round, review == null ? "gates" : "reviewer", string.Join(" | ", problems.Take(MaxReasons)));
            if (round >= 1)
            {
                return Done(null, "rejected", review == null ? "gates" : "reviewer", round);
            }

            ask = request with { Previous = written, Problems = problems.Take(MaxReasons).ToList() };
        }
    }

    /// <summary>Main tenses the record has no row for, in the card's order. The present is a gate, not a gap.</summary>
    public static IReadOnlyList<string> MissingMainTenses(IReadOnlyDictionary<string, string[][]> tenses) =>
        MainTensesAfterPresent.Where(t => !tenses.TryGetValue(t, out var row) || row.All(cell => cell.Length == 0)).ToList();

    /// <summary>
    /// True when the record is short of tenses only because the verb itself is: every missing main tense
    /// was declared non-existent by the generator, the reviewer did not object, and no row has a hole.
    /// The card then says so instead of "only a part of the tenses is known".
    /// </summary>
    public static bool LacksTensesForGood(VerbParadigm draft, IReadOnlyList<MissingTense> missing) =>
        missing.Count > 0
        && missing.All(m => m is { Why: MissingTense.VerbLacksIt, ReviewerDisagrees: false })
        && draft.Tenses.Where(t => VerbAnalyzer.CardTenses.Contains(t.Key)).All(t => t.Value.All(cell => cell.Length > 0));

    /// <summary>
    /// The rows a rejected record may be stored without, or null when it may not: the reviewer rejects
    /// whole rows only (never the present) and says the rest of the record is right. A row of the
    /// first pass is given to the generator to repair first, so it is set aside only on the last round;
    /// rows of the completion round are extras the reviewer has to confirm — they go at once.
    /// </summary>
    private static IReadOnlyList<string>? RowsToSetAside(VerbReview review, VerbParadigm draft, List<string> completed, bool lastRound)
    {
        var rows = (review.WrongTenses ?? []).Where(draft.Tenses.ContainsKey).Distinct().ToList();
        return review.RestIsRight && rows.Count > 0 && !rows.Contains("present") && (lastRound || rows.All(completed.Contains))
            ? rows
            : null;
    }

    /// <summary>The record without the given rows — null when it then fails a gate (the looked-up Georgian word was in one of them).</summary>
    private static (GeneratedVerb Written, VerbParadigm Draft)? Without(
        string lemma, GeneratedVerb written, IReadOnlyList<string> rows, List<string> askedWords)
    {
        var reduced = written with
        {
            Tenses = (written.Tenses ?? new Dictionary<string, string?[]>())
                .Where(t => !rows.Contains(t.Key))
                .ToDictionary(t => t.Key, t => t.Value),
            // The cell the text was read as is gone with its row: the answer is then the verb itself.
            MatchedTense = written.MatchedTense != null && rows.Contains(written.MatchedTense) ? null : written.MatchedTense
        };
        var problems = new List<string>();
        var draft = Draft(lemma, reduced, askedWords, problems);
        return draft == null || problems.Count > 0 ? null : (reduced, draft);
    }

    /// <summary>
    /// The completion call. It is an extra: when it fails or runs out of time the record goes on to the
    /// reviewer as it was written, and the missing tenses stay "not sure".
    /// </summary>
    private async Task<VerbCompletion?> CompleteAsync(
        VerbGenerationRequest request, GeneratedVerb written, IReadOnlyList<string> absent, CancellationTokenSource timeout, CancellationToken ct)
    {
        using (timeout)
        {
            try
            {
                return await generator.CompleteAsync(new VerbCompletionRequest(request, written, absent), timeout.Token);
            }
            catch (Exception e) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(
                    "Completion round for {Lemma} failed ({Error}); the record goes on without {Tenses}",
                    written.Lemma, GeorgianTranslationPipeline.Describe(e), string.Join(", ", absent));
                return null;
            }
        }
    }

    /// <summary>
    /// Puts what the completion round gave into the record. A row is taken only when it passes the same
    /// gates as any other (six cells, Georgian script); the rows that were there are never touched.
    /// </summary>
    private (GeneratedVerb Written, VerbParadigm Draft) Merge(
        string lemma,
        GeneratedVerb written,
        VerbParadigm draft,
        List<string> askedWords,
        VerbCompletion? completion,
        IReadOnlyList<string> absent,
        Dictionary<string, string?> declaredAbsent,
        Dictionary<string, string?> unsureNotes,
        List<string> completed)
    {
        var tenses = new Dictionary<string, string?[]>(written.Tenses ?? new Dictionary<string, string?[]>());
        foreach (var tense in absent)
        {
            var answer = completion?.Tenses.GetValueOrDefault(tense);
            var cells = answer?.Cells;
            var usable = cells is { Length: 6 }
                         && cells.Any(c => !string.IsNullOrWhiteSpace(c))
                         && cells.All(c => string.IsNullOrWhiteSpace(c) || IsGeorgianWord(c!.Trim()));
            if (usable && !ConfirmedByTexts(cells!))
            {
                // Forms given only on the second ask need something besides the model's word for them.
                unsureNotes[tense] = "the forms the generator gave were not found in real texts";
            }
            else if (usable)
            {
                tenses[tense] = cells!;
                completed.Add(tense);
            }
            else if (answer is { NoSuchTense: true })
            {
                declaredAbsent[tense] = Short(answer.Reason);
            }
            else
            {
                unsureNotes[tense] = Short(answer?.Reason);
            }
        }

        logger.LogInformation(
            "Completion round for {Lemma}: asked for {Asked}; added {Added}; verb has no such tense: {Absent}; not sure: {Unsure}",
            lemma, string.Join(", ", absent), string.Join(", ", completed), string.Join(", ", declaredAbsent.Keys),
            string.Join(", ", absent.Except(completed).Except(declaredAbsent.Keys)));
        if (completed.Count == 0)
        {
            return (written, draft);
        }

        var merged = written with { Tenses = tenses };
        var problems = new List<string>();
        var redrafted = Draft(lemma, merged, askedWords, problems);
        if (redrafted == null || problems.Count > 0)
        {
            // Cannot happen with rows that passed the checks above; if it does, the record stays as it was.
            completed.Clear();
            return (written, draft);
        }

        return (merged, redrafted);
    }

    /// <summary>
    /// A row of the completion round is taken when at least half of its forms occur in the corpora of
    /// real texts (when that data is loaded at all). Measured on catalog verbs, whose forms are known to
    /// be right: every future, aorist and optative form is attested, three conditional forms in four.
    /// </summary>
    private bool ConfirmedByTexts(string?[] cells)
    {
        var forms = cells.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim()).ToList();
        return !lexicon.HasAttestedForms || forms.Count(lexicon.IsAttested) * 2 >= forms.Count;
    }

    private static string? Short(string? reason) =>
        string.IsNullOrWhiteSpace(reason) ? null : reason.Trim().Length > MaxReasonLength ? reason.Trim()[..MaxReasonLength] : reason.Trim();

    /// <summary>The record as a paradigm, with what the hard gates found wrong added to <paramref name="problems"/>.</summary>
    private static VerbParadigm? Draft(string lemma, GeneratedVerb written, List<string> askedWords, List<string> problems)
    {
        if (!IsGeorgianWord(lemma))
        {
            problems.Add("\"lemma\" must be one Georgian word in Georgian script");
            return null;
        }

        var tenses = new Dictionary<string, string[][]>();
        foreach (var (tense, cells) in written.Tenses ?? new Dictionary<string, string?[]>())
        {
            if (cells == null || cells.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            if (!VerbAnalyzer.KnownTenses.Contains(tense))
            {
                continue;
            }

            if (cells.Length != 6)
            {
                problems.Add($"tense \"{tense}\" must have exactly six cells (I, you sg, he/she, we, you pl, they); it has {cells.Length}");
                continue;
            }

            var bad = cells.Where(c => !string.IsNullOrWhiteSpace(c) && !IsGeorgianWord(c!.Trim())).ToList();
            if (bad.Count > 0)
            {
                problems.Add($"tense \"{tense}\": every cell must be one Georgian word in Georgian script, or null; not {string.Join(", ", bad)}");
                continue;
            }

            tenses[tense] = cells.Select(c => string.IsNullOrWhiteSpace(c) ? Array.Empty<string>() : [c!.Trim()]).ToArray();
        }

        if (!tenses.TryGetValue("present", out var present) || present[2].Length == 0 || present[2][0] != lemma)
        {
            problems.Add("\"present\" is required and its third cell (he/she) must be the lemma itself");
        }

        problems.AddRange(VerbMeaningBuilder.ShapeProblems(written.RussianForms));

        var masdar = IsGeorgianWord(written.Masdar?.Trim()) ? new[] { written.Masdar!.Trim() } : [];
        var draft = new VerbParadigm(lemma, masdar, tenses, [], Source: null, Revid: null);
        if (askedWords.Count > 0 && !askedWords.Any(draft.Contains))
        {
            problems.Add($"the looked-up word {string.Join(" ", askedWords)} is not among the forms you wrote: " +
                         "either it is a form of this verb and a cell is wrong, or it is another verb");
        }

        return draft;
    }

    /// <summary>The cell the looked-up text is: found by our code for a Georgian word, the model's claim for a Russian one.</summary>
    private static (string Form, string Tense, int Person)? Matched(VerbParadigm draft, GeneratedVerb written, List<string> askedWords)
    {
        foreach (var tense in VerbAnalyzer.KnownTenses.Where(draft.Tenses.ContainsKey))
        {
            for (var person = 0; person < 6; person++)
            {
                if (draft.Tenses[tense][person].Any(askedWords.Contains))
                {
                    return (draft.Tenses[tense][person][0], tense, person);
                }
            }
        }

        return askedWords.Count == 0
               && written.MatchedTense != null
               && written.MatchedPerson is >= 0 and < 6
               && draft.Tenses.TryGetValue(written.MatchedTense, out var row)
               && row[written.MatchedPerson.Value].Length > 0
            ? (row[written.MatchedPerson.Value][0], written.MatchedTense, written.MatchedPerson.Value)
            : null;
    }

    private VerbEvidence Evidence(VerbParadigm draft, string? askedInfinitive)
    {
        var forms = draft.AllForms().Distinct().ToList();
        var unattested = lexicon.HasAttestedForms ? forms.Where(f => !lexicon.IsAttested(f)).ToList() : [];
        return new VerbEvidence(
            lexicon.Find(draft.Lemma).FirstOrDefault(v => v.Lemma == draft.Lemma),
            askedInfinitive == null ? [] : lexicon.FindByRussian(askedInfinitive),
            lexicon.HasAttestedForms,
            forms.Count,
            forms.Count - unattested.Count,
            unattested);
    }

    private VerbProvenance Provenance(
        string askedText, int rounds, VerbEvidence evidence, VerbReview review, IReadOnlyList<MissingTense> missing, IReadOnlyList<string> completed) => new()
    {
        Id = Guid.NewGuid(),
        AskedText = askedText.Length > 128 ? askedText[..128] : askedText,
        GeneratorModel = options.Value.GeneratorModel,
        ReviewerModel = options.Value.ReviewerModel,
        ApprovedAtUtc = DateTime.UtcNow,
        RepairRounds = rounds,
        FormsTotal = evidence.FormsTotal,
        FormsAttested = evidence.FormsAttested,
        UnattestedFormsJson = System.Text.Json.JsonSerializer.Serialize(evidence.Unattested, Json),
        MissingTensesJson = System.Text.Json.JsonSerializer.Serialize(missing, Json),
        CompletedTensesJson = System.Text.Json.JsonSerializer.Serialize(completed, Json),
        LemmaInLexicon = evidence.LexiconEntry != null,
        ReviewerReasons = string.Join(
            "\n", review.Reasons.Take(MaxReasons).Select(r => r.Length > MaxReasonLength ? r[..MaxReasonLength] : r))
    };

    private async Task<VerbGenerationOutcome> ExistingAsync(
        Verb existing,
        string? askedInfinitive,
        List<string> askedWords,
        Func<ResolvedVerb?, string, string?, int, VerbGenerationOutcome> done,
        int round,
        CancellationToken ct,
        bool sourcedByLexicon = false)
    {
        if (askedInfinitive != null)
        {
            if (!VerbProposalResolver.GlossParts(existing.Translation).Contains(askedInfinitive))
            {
                // Same rule as in VerbProposalResolver: a curated gloss is the definition of the verb
                // (unless the open lexicon itself gives the word for it); a verb stored at runtime
                // only gets one more Russian word that leads to it.
                if (RuntimeVerbStore.IsRuntime(existing))
                {
                    await store.AddGlossAsync(existing, askedInfinitive, ct);
                }
                else if (!sourcedByLexicon)
                {
                    return done(null, "rejected", "catalog-verb-has-another-russian-gloss", round);
                }
            }

            return done(new ResolvedVerb(existing, null, "existing"), "existing", null, round);
        }

        var form = await dbContext.VerbForms
            .Where(f => f.VerbId == existing.Id && askedWords.Contains(f.Form))
            .Select(f => f.Form)
            .FirstOrDefaultAsync(ct);
        return form == null && !askedWords.Contains(existing.Title)
            ? done(null, "rejected", "word-is-not-a-form-of-the-stored-verb", round)
            : done(new ResolvedVerb(existing, form, "existing"), "existing", null, round);
    }

    private static bool IsGeorgianWord(string? value) =>
        value is { Length: > 0 and <= VerbParadigm.MaxFormLength } && VerbParadigm.GeorgianWord.IsMatch(value);

    private static CancellationTokenSource Timeout(int seconds, CancellationToken ct)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(ct);
        source.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, seconds)));
        return source;
    }
}
