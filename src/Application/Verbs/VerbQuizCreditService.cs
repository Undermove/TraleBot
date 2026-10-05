using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>
/// What the generic vocabulary quiz does with a dictionary entry that is a single verb form: the
/// entry stays in the quiz like any other word (nothing changes for people with existing words),
/// and a correct answer is also credited to the verb — the form moves one step, as a recognition
/// answer does in a verb session. Recognition only: the quiz never lifts a form above "solid"
/// (<see cref="VerbLevelRules.SolidStep"/>) and a wrong answer never lowers it.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbQuizCreditService(
    ITraleDbContext dbContext, VerbQueries verbs, VerbProgressService formProgress, VerbLearningService learning)
{
    public async Task CreditCorrectAnswerAsync(User user, Guid wordId, DateTime now, CancellationToken ct)
    {
        var entry = await dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(v => v.Id == wordId && v.UserId == user.Id)
            .Select(v => new { v.Word, v.Definition })
            .FirstOrDefaultAsync(ct);
        if (entry == null)
        {
            return;
        }

        var hits = await verbs.FindInTextsAsync(new[] { entry.Word, entry.Definition }, ct);
        var found = MyVerbsQuery.Find(entry.Word, entry.Definition, hits);
        if (found is not { Single: true })
        {
            return;
        }

        var hit = found.Value.Hit;
        var state = await formProgress.GetAsync(user.Id, hit.Lemma, now, ct);
        if (state is not { CanLearn: true })
        {
            return;
        }

        var form = state.Forms.FirstOrDefault(f => f.Tense == hit.Tense && f.Person == hit.Person);
        var step = form?.Step ?? 0;
        if (step >= VerbLevelRules.SolidStep)
        {
            return;
        }

        await formProgress.SaveAsync(
            user.Id, hit.Lemma, new[] { new VerbFormStep(hit.Tense, hit.Person, step + 1, form?.Reviews ?? 0, now) }, now, ct);
        await learning.TouchAsync(user.Id, hit.Lemma, now, ct);
    }
}
