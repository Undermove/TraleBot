using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Verbs;

/// <summary>A verb of a family as the learner sees it. <paramref name="CardJson"/> is the stored verb card (forms and meanings).</summary>
public record FamilyVerbView(VerbFamilyMember Member, string Title, string Translation, VerbLevel Level, string CardJson);

/// <param name="LessonDone">The learner completed the lessons that explain direction prefixes — the prefix session skips its introduction.</param>
public record VerbFamilyView(VerbFamily Family, IReadOnlyList<FamilyVerbView> Verbs, bool BaseLearned, bool LessonDone);

/// <summary>What a verb's own state says about its family.</summary>
/// <param name="BaseLearned">For a member: the base verb is learned, so only the prefix is left to learn.</param>
public record VerbFamilyState(VerbFamily Family, VerbFamilyMember Member, bool BaseLearned, bool LessonDone);

/// <summary>
/// Verb families for one learner: the family with every member's forms (what the prefix session
/// plays with), the family note of a verb card, and whether the base verb is learned.
/// Service per ARCHITECTURE.md.
/// </summary>
public class VerbFamilyQuery(ITraleDbContext dbContext, VerbFamilyCatalog families, IProgressCalculator progressCalculator)
{
    /// <summary>Null when there is no such family.</summary>
    public async Task<VerbFamilyView?> GetAsync(User user, string familyId, CancellationToken ct)
    {
        var family = families.Find(familyId);
        if (family == null)
        {
            return null;
        }

        var lemmas = family.Members.Select(m => m.Lemma).ToList();
        // Only curated verbs: a model-made verb never joins a family, whatever its lemma.
        var verbs = (await dbContext.Verbs
                .AsNoTracking()
                .Where(v => lemmas.Contains(v.Lemma) && v.Status == VerbStatus.Verified)
                .Select(v => new { v.Id, v.Lemma, v.Title, v.Translation, v.CardJson })
                .ToListAsync(ct))
            .ToDictionary(v => v.Lemma);
        var ids = verbs.Values.Select(v => v.Id).ToList();
        var levels = await dbContext.UserVerbs
            .AsNoTracking()
            .Where(v => v.UserId == user.Id && ids.Contains(v.VerbId))
            .ToDictionaryAsync(v => v.VerbId, v => v.Level, ct);

        var views = family.Members
            .Where(m => verbs.ContainsKey(m.Lemma))
            .Select(m =>
            {
                var verb = verbs[m.Lemma];
                return new FamilyVerbView(m, verb.Title, verb.Translation, levels.GetValueOrDefault(verb.Id, VerbLevel.New), verb.CardJson);
            })
            .ToList();
        var baseLearned = views.Any(v => v.Member.Role == VerbFamilyCatalog.Base && v.Level == VerbLevel.Learned);
        return new VerbFamilyView(family, views, baseLearned, await LessonDoneAsync(user.Id, family, ct));
    }

    /// <summary>Null for a verb outside any family.</summary>
    public async Task<VerbFamilyState?> StateAsync(Guid userId, string lemma, CancellationToken ct)
    {
        if (families.Of(lemma) is not var (family, member))
        {
            return null;
        }

        return new VerbFamilyState(
            family, member, await BaseLearnedAsync(userId, family, ct), await LessonDoneAsync(userId, family, ct));
    }

    public Task<bool> BaseLearnedAsync(Guid userId, VerbFamily family, CancellationToken ct) =>
        dbContext.UserVerbs.AnyAsync(v => v.UserId == userId && v.Verb.Lemma == family.Base && v.Level == VerbLevel.Learned, ct);

    /// <summary>
    /// Adds <c>family</c> to a verb card: what the verb is in its family (the base, or the base with
    /// which prefix), the prefixes to highlight in its forms, and the other members to link to.
    /// The card of a verb outside any family is returned as it is.
    /// </summary>
    public async Task<string> DecorateCardAsync(string cardJson, string lemma, CancellationToken ct)
    {
        if (families.Of(lemma) is not var (family, member))
        {
            return cardJson;
        }

        var card = JsonNode.Parse(cardJson)!.AsObject();
        // Family data describes the curated verb; a model-made record under the same lemma stays an ordinary verb.
        if (card["status"]?.GetValue<string>() == "generated")
        {
            return cardJson;
        }

        var lemmas = family.Members.Select(m => m.Lemma).ToList();
        var names = (await dbContext.Verbs
                .AsNoTracking()
                .Where(v => lemmas.Contains(v.Lemma))
                .Select(v => new { v.Lemma, v.Title, v.Translation })
                .ToListAsync(ct))
            .ToDictionary(v => v.Lemma);

        card["family"] = new JsonObject
        {
            ["id"] = family.Id,
            ["title"] = family.Title,
            ["baseName"] = family.BaseName,
            ["role"] = member.Role,
            ["prefixes"] = new JsonArray(member.Prefixes.Select(p => (JsonNode?)p).ToArray()),
            ["direction"] = member.Direction,
            ["toward"] = member.Toward,
            ["directionRu"] = member.DirectionRu,
            ["lessonModule"] = family.LessonModule,
            ["members"] = new JsonArray(family.Members
                .Where(m => names.ContainsKey(m.Lemma))
                .Select(m => (JsonNode?)new JsonObject
                {
                    ["id"] = m.Lemma,
                    ["title"] = names[m.Lemma].Title,
                    ["ru"] = names[m.Lemma].Translation,
                    ["role"] = m.Role,
                    ["direction"] = m.Direction,
                    ["toward"] = m.Toward,
                    ["directionRu"] = m.DirectionRu
                })
                .ToArray())
        };
        return card.ToJsonString(VerbQueries.CardJsonOptions);
    }

    private async Task<bool> LessonDoneAsync(Guid userId, VerbFamily family, CancellationToken ct)
    {
        if (family.LessonModule.Length == 0 || family.IntroLessons.Count == 0)
        {
            return true;
        }

        var miniApp = await dbContext.MiniAppUserProgresses.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return miniApp != null && progressCalculator.CompletedLessons(miniApp, family.LessonModule) >= family.IntroLessons.Count;
    }
}
