using System.Collections.Generic;
using System.Linq;

namespace Application.Verbs;

/// <summary>How much of the six main tenses a verb's table has.</summary>
/// <param name="Tenses">Main tenses with at least one form, 0–6.</param>
/// <param name="Cells">Filled cells of those tenses, 0–36.</param>
/// <param name="Missing">Main tenses with no form at all, in the card's order.</param>
public record VerbCompleteness(int Tenses, int Cells, IReadOnlyList<string> Missing)
{
    public static VerbCompleteness Of(IReadOnlyDictionary<string, string[][]> tenses)
    {
        var filled = VerbAnalyzer.CardTenses
            .Where(t => tenses.TryGetValue(t, out var row) && row.Any(cell => cell.Length > 0))
            .ToList();
        return new VerbCompleteness(
            filled.Count,
            filled.Sum(t => tenses[t].Count(cell => cell.Length > 0)),
            VerbAnalyzer.CardTenses.Except(filled).ToList());
    }
}
