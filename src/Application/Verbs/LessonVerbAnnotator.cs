using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Domain.Entities;

namespace Application.Verbs;

/// <summary>
/// The Georgian a learner sees in one lesson question, in the order the verb is looked for:
/// the correct answer first, the question text last. Wrong options are deliberately not here —
/// a verb that only appears in a distractor is not what the question is about.
/// </summary>
public record LessonQuestionTexts(string? CorrectAnswer, string? BuiltSentence, string? Transcript, string? Question)
{
    public IEnumerable<string> InLookupOrder() =>
        new[] { CorrectAnswer, BuiltSentence, Transcript, Question }.Where(t => !string.IsNullOrWhiteSpace(t))!;
}

/// <summary>
/// Verbs as a layer over lessons: marks the questions that contain a form of a catalog verb, so the
/// mini-app can offer the verb card after the answer. Service per ARCHITECTURE.md.
/// </summary>
public class LessonVerbAnnotator(VerbQueries verbs)
{
    /// <summary>
    /// One hit (or null) per question, in the same order. Nothing is annotated for a viewer without
    /// trial/Pro: the verb card is behind that access, and a hint that opens a paywalled card
    /// in the middle of a free lesson would be a dead end.
    /// </summary>
    public async Task<IReadOnlyList<VerbFormHit?>> AnnotateAsync(
        User? viewer, IReadOnlyList<LessonQuestionTexts> questions, CancellationToken ct)
    {
        var result = new VerbFormHit?[questions.Count];
        if (viewer == null || !viewer.HasMiniAppAccess())
        {
            return result;
        }

        // One query for the whole lesson.
        var hits = await verbs.FindInTextsAsync(questions.SelectMany(q => q.InLookupOrder()).ToList(), ct);
        for (var i = 0; i < questions.Count; i++)
        {
            var text = questions[i].InLookupOrder().FirstOrDefault(hits.ContainsKey);
            result[i] = text == null ? null : hits[text];
        }

        return result;
    }
}
