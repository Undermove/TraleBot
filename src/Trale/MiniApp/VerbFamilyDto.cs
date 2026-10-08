using System.Collections.Generic;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Verbs;

namespace Trale.MiniApp;

/// <summary>
/// The answer of <c>GET /api/miniapp/verbs/families/{id}</c>. Georgian in it comes from two places
/// only: verb cards (forms) and the theory of the lessons about direction prefixes (the introduction).
/// </summary>
public static class VerbFamilyDto
{
    /// <summary>The six main tenses — the ones sessions play with (CARD_TENSES in the mini-app).</summary>
    private static readonly string[] MainTenses = { "present", "aorist", "imperfect", "optative", "conditional", "future" };

    public static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static JsonObject Build(VerbFamilyView view, ModuleDto? lessons)
    {
        return new JsonObject
        {
            ["id"] = view.Family.Id,
            ["title"] = view.Family.Title,
            ["baseName"] = view.Family.BaseName,
            ["baseId"] = view.Family.Base,
            ["baseLearned"] = view.BaseLearned,
            ["members"] = new JsonArray(view.Verbs.Select(v => (JsonNode?)Member(v)).ToArray()),
            ["intro"] = new JsonObject
            {
                ["lessonDone"] = view.LessonDone,
                ["moduleId"] = lessons?.Id,
                ["moduleTitle"] = lessons?.Title,
                ["screens"] = new JsonArray(Screens(view.Family, lessons).ToArray())
            }
        };
    }

    private static JsonObject Member(FamilyVerbView verb)
    {
        var card = JsonNode.Parse(verb.CardJson)!.AsObject();
        var tenses = new JsonObject();
        var meanings = new JsonObject();
        foreach (var tense in MainTenses)
        {
            if (card["tenses"]?[tense] is JsonArray forms)
            {
                tenses[tense] = forms.DeepClone();
            }

            if (card["meanings"]?[tense] is JsonArray phrases)
            {
                meanings[tense] = phrases.DeepClone();
            }
        }

        return new JsonObject
        {
            ["id"] = verb.Member.Lemma,
            ["title"] = verb.Title,
            ["ru"] = verb.Translation,
            ["role"] = verb.Member.Role,
            ["prefixes"] = new JsonArray(verb.Member.Prefixes.Select(p => (JsonNode?)p).ToArray()),
            ["direction"] = verb.Member.Direction,
            ["toward"] = verb.Member.Toward,
            ["directionRu"] = verb.Member.DirectionRu,
            ["level"] = VerbLevelRules.Key(verb.Level),
            ["tenses"] = tenses,
            ["meanings"] = meanings
        };
    }

    /// <summary>
    /// One screen per introductory lesson: its title and the lines of its theory lists that are
    /// about a prefix of this family, word for word. A lesson with no such line gives no screen.
    /// </summary>
    private static IEnumerable<JsonNode?> Screens(VerbFamily family, ModuleDto? lessons)
    {
        if (lessons == null)
        {
            yield break;
        }

        var prefixes = family.Members.SelectMany(m => m.Prefixes).ToHashSet();
        foreach (var id in family.IntroLessons)
        {
            var lesson = lessons.Lessons.FirstOrDefault(l => l.Id == id);
            var lines = (lesson?.Theory.Blocks ?? new List<TheoryBlockDto>())
                .Where(b => b.Type == "list" && b.Items != null)
                .SelectMany(b => b.Items)
                .Where(line => prefixes.Any(p => line.StartsWith(p + "- ")))
                .ToList();
            if (lines.Count > 0)
            {
                yield return new JsonObject
                {
                    ["lessonId"] = id,
                    ["title"] = lesson!.Theory.Title,
                    ["lines"] = new JsonArray(lines.Select(l => (JsonNode?)l).ToArray())
                };
            }
        }
    }
}
