using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// The verb behind a translated word or phrase, for the bot's reply: which verb, and — when a
/// concrete form was found — its tense and person, and what the form means in plain Russian.
/// </summary>
public record VerbReplyHint(
    string Lemma,
    string Title,
    string Translation,
    VerbStatus Status,
    string? Form,
    string? Tense,
    int? Person,
    string? Meaning = null,
    string? MeaningNote = null);

/// <summary>
/// Finds the verb to mention under a translation in the bot chat. Like
/// <see cref="VerbQueries.FindInTextsAsync"/>, plus two things a chat reply needs: the masdar is
/// recognised too (the usual answer to a Russian infinitive), and the verb's status comes along.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbReplyHintQuery(ITraleDbContext dbContext)
{
    private static readonly Regex GeorgianWord = new("[ა-ჰ]+", RegexOptions.Compiled);

    /// <param name="texts">The looked-up text and its translation, in the order they should be searched.</param>
    public async Task<VerbReplyHint?> FindAsync(IEnumerable<string?> texts, CancellationToken ct)
    {
        var words = texts
            .SelectMany(t => GeorgianWord.Matches(t ?? string.Empty).Select(m => m.Value))
            .Distinct()
            .ToList();
        if (words.Count == 0)
        {
            return null;
        }

        var forms = await dbContext.VerbForms
            .AsNoTracking()
            .Where(f => words.Contains(f.Form))
            .OrderBy(f => f.Verb.SortOrder)
            .ThenBy(f => f.Person)
            .Select(f => new VerbReplyHint(
                f.Verb.Lemma, f.Verb.Title, f.Verb.Translation, f.Verb.Status, f.Form, f.Tense, f.Person,
                f.Meaning, f.MeaningNote))
            .ToListAsync(ct);
        var byForm = words.Select(w => forms.FirstOrDefault(f => f.Form == w)).FirstOrDefault(f => f != null);
        if (byForm != null)
        {
            return byForm;
        }

        var masdars = await dbContext.Verbs
            .AsNoTracking()
            .Where(v => words.Contains(v.Title))
            .OrderBy(v => v.SortOrder)
            .Select(v => new VerbReplyHint(v.Lemma, v.Title, v.Translation, v.Status, null, null, null))
            .ToListAsync(ct);
        return words.Select(w => masdars.FirstOrDefault(m => m.Title == w)).FirstOrDefault(m => m != null);
    }
}
