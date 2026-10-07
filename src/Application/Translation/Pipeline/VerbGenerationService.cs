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
public record VerbGenerationOutcome(
    ResolvedVerb? Verb, string Outcome, string? Reason, ModelUsage Generator, ModelUsage Reviewer, int RepairRounds,
    VerbGenerationDraft? Draft = null, VerbProposal? SourceTable = null)
{
    public bool NotAWord => Outcome == "not-a-word";
}

/// <summary>A record as it was shown to the reviewer, and what the reviewer said.</summary>
public record VerbGenerationDraft(
    VerbParadigm Paradigm, string Russian, VerbMeanings Meanings, VerbEvidence Evidence, VerbReview Review);

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
/// At most one repair round: what the gates or the reviewer named goes back to the generator once.
/// After that the record is approved or dropped — nothing is stored and the caller translates the
/// plain way.
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

    private static readonly Regex GeorgianWords = new("[ა-ჰ]+", RegexOptions.Compiled);

    /// <param name="request">What was asked, with the cheap agent's hint and the lexicon's candidates.</param>
    /// <param name="preview">
    /// True: write and review only — nothing is stored and what the base already has is not looked at.
    /// The outcome is then "approved" instead of "stored". For comparing models and for reports.
    /// </param>
    /// <param name="progress">Told when the generator and the reviewer are asked and when the verb is stored.</param>
    public async Task<VerbGenerationOutcome> GenerateAsync(
        VerbGenerationRequest request, CancellationToken ct, bool preview = false, ITranslationProgress? progress = null)
    {
        var generatorUsage = ModelUsage.None;
        var reviewerUsage = ModelUsage.None;
        var askedWords = request.IsRussian ? [] : GeorgianWords.Matches(request.Text).Select(m => m.Value).ToList();
        var askedInfinitive = request.IsRussian ? VerbProposalResolver.NormalizeGloss(request.Infinitive ?? request.Text) : null;

        VerbGenerationDraft? lastDraft = null;
        VerbGenerationOutcome Done(ResolvedVerb? verb, string outcome, string? reason, int rounds) =>
            new(verb, outcome, reason, generatorUsage, reviewerUsage, rounds, lastDraft);

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
            progress?.Report(TranslationStage.VerbForms);
            using (var timeout = Timeout(options.Value.GeneratorTimeoutSeconds, ct))
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

            VerbReview? review = null;
            VerbEvidence? evidence = null;
            VerbMeanings? meanings = null;
            (string Form, string Tense, int Person)? matched = null;
            if (draft != null && glosses != null && problems.Count == 0)
            {
                meanings = VerbMeaningBuilder.Build(written.RussianForms!, draft.Tenses.Keys.ToList());
                matched = Matched(draft, written, askedWords);
                evidence = Evidence(draft, askedInfinitive);
                progress?.Report(TranslationStage.VerbReview);
                using var timeout = Timeout(options.Value.ReviewerTimeoutSeconds, ct);
                review = await reviewer.ReviewAsync(
                    new VerbReviewRequest(
                        request.Text, request.IsRussian, askedInfinitive, draft.Lemma, draft.Masdar.FirstOrDefault(), glosses,
                        draft.Tenses, meanings.Meanings, matched?.Form, matched?.Tense, matched?.Person, evidence),
                    timeout.Token);
                reviewerUsage += review.Usage ?? ModelUsage.None;
                lastDraft = new VerbGenerationDraft(draft, glosses, meanings, evidence, review);
                if (review.Approved && preview)
                {
                    return Done(null, "approved", null, round);
                }

                if (review.Approved)
                {
                    progress?.Report(TranslationStage.Saving);
                    var verb = await store.AddAsync(
                        draft, glosses, VerbStatus.Generated, ct, verification: null, meanings,
                        Provenance(request.Text, round, evidence, review));
                    return Done(new ResolvedVerb(verb, matched?.Form, "generated"), "stored", null, round);
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

    private VerbProvenance Provenance(string askedText, int rounds, VerbEvidence evidence, VerbReview review) => new()
    {
        Id = Guid.NewGuid(),
        AskedText = askedText.Length > 128 ? askedText[..128] : askedText,
        GeneratorModel = options.Value.GeneratorModel,
        ReviewerModel = options.Value.ReviewerModel,
        ApprovedAtUtc = DateTime.UtcNow,
        RepairRounds = rounds,
        FormsTotal = evidence.FormsTotal,
        FormsAttested = evidence.FormsAttested,
        UnattestedFormsJson = System.Text.Json.JsonSerializer.Serialize(
            evidence.Unattested,
            new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }),
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
