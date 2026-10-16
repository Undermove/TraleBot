using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The "Глаголы" section is served from the database, loaded from the curated catalog
/// <c>src/Trale/Verbs/verbs.json</c>. These tests pin the contract between that file, the seeder
/// and the queries behind /api/miniapp/verbs — against real Postgres.
/// </summary>
public class VerbCatalogTests : TestBase
{
    private static string CatalogJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = _testServer.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    [SetUp]
    public async Task SeedCatalog()
    {
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            return await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None);
        });
    }

    [Test]
    public async Task Seeding_loads_every_catalog_verb_as_verified()
    {
        var expected = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray().Count;

        var verbs = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.ToListAsync());

        verbs.Should().HaveCount(expected);
        verbs.Should().OnlyContain(v => v.Status == VerbStatus.Verified);
    }

    [Test]
    public async Task Catalog_verb_marked_for_whom_carries_it_in_its_card_with_forms_real_texts_have()
    {
        var marked = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray().Select(v => v!.AsObject()).Where(v => v.ContainsKey("objectPerson")).ToList();
        marked.Should().NotBeEmpty();
        var lexicon = VerbLexicon.Load(Path.Combine(AppContext.BaseDirectory, "Verbs"));

        foreach (var entry in marked)
        {
            var lemma = entry["lemma"]!.GetValue<string>();
            var card = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.Where(v => v.Lemma == lemma).Select(v => v.CardJson).SingleAsync());
            JsonNode.Parse(card)!["objectPerson"]!.GetValue<string>().Should().Be(entry["objectPerson"]!.GetValue<string>());

            // The forms the mini-app builds by the rule are not invented: real texts have at least two of them.
            var tenses = entry["tenses"]!.Deserialize<Dictionary<string, string[][]>>()!;
            ObjectPerson.AllForms(tenses).Count(lexicon.IsAttested).Should().BeGreaterThanOrEqualTo(2, because: lemma);
        }
    }

    [Test]
    public async Task Seeding_twice_writes_nothing_the_second_time()
    {
        var second = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));
        var forms = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync());

        second.Written.Should().Be(0, because: "unchanged catalog entries must not be rewritten on every restart");
        forms.Should().BeGreaterThan(0);
    }

    [Test]
    public async Task Changed_entry_is_rewritten_without_duplicating_its_forms()
    {
        var formsBefore = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync());
        var catalog = JsonNode.Parse(CatalogJson())!;
        var first = catalog["verbs"]![0]!.AsObject();
        first["ru"] = "перевод (правка)";

        var result = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog.ToJsonString(), CancellationToken.None));
        var formsAfter = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync());
        var list = await InScope(sp => sp.GetRequiredService<VerbQueries>().ListAsync(CancellationToken.None));

        result.Written.Should().Be(1);
        formsAfter.Should().Be(formsBefore);
        list[0].Translation.Should().Be("перевод (правка)");
    }

    [Test]
    public async Task Name_of_the_action_corrected_in_the_catalog_reaches_a_base_seeded_before_and_keeps_what_learners_have()
    {
        // The base as it was seeded before the correction: these verbs had the dictionary form (or
        // another verb's word) for a title and no titleSources.
        var corrected = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray()
            .Select(v => v!.AsObject()).Where(v => v.ContainsKey("titleSources")).ToList();
        corrected.Select(v => v["ru"]!.GetValue<string>()).Should().Contain(["быть", "ходить"]);
        var before = JsonNode.Parse(CatalogJson())!;
        foreach (var verb in before["verbs"]!.AsArray().Select(v => v!.AsObject()).Where(v => v.ContainsKey("titleSources")))
        {
            verb["title"] = verb["lemma"]!.GetValue<string>();
            verb.Remove("titleSources");
        }

        var be = corrected.Single(v => v["ru"]!.GetValue<string>() == "быть");
        var lemma = be["lemma"]!.GetValue<string>();
        var (verbId, formsBefore) = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(before.ToJsonString(), CancellationToken.None);

            var row = await db.Verbs.SingleAsync(v => v.Lemma == lemma);
            row.Title.Should().Be(lemma);
            var user = IntegrationTests.DSL.Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(user);
            db.UserVerbs.Add(new UserVerb { Id = Guid.NewGuid(), UserId = user.Id, VerbId = row.Id, StartedAtUtc = DateTime.UtcNow });
            db.VerbFormProgresses.Add(new VerbFormProgress { Id = Guid.NewGuid(), UserId = user.Id, VerbId = row.Id, Tense = "present", Person = 0, Step = 2, BestStep = 2, CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync(CancellationToken.None);
            return (row.Id, await db.VerbForms.CountAsync(f => f.VerbId == row.Id));
        });

        // The next start of the server: the catalog as it is now.
        var result = await InScope(sp => sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));

        result.Written.Should().Be(corrected.Count, because: "only the corrected verbs are rewritten");
        result.Removed.Should().Be(0);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            foreach (var verb in corrected)
            {
                var stored = await db.Verbs.AsNoTracking().SingleAsync(v => v.Lemma == verb["lemma"]!.GetValue<string>());
                stored.Title.Should().Be(verb["title"]!.GetValue<string>());
                JsonNode.Parse(stored.CardJson)!["title"]!.GetValue<string>().Should().Be(stored.Title);
            }

            var row = await db.Verbs.AsNoTracking().SingleAsync(v => v.Lemma == lemma);
            row.Id.Should().Be(verbId, because: "the row is updated in place, so what learners have stays attached");
            (await db.VerbForms.CountAsync(f => f.VerbId == verbId)).Should().Be(formsBefore);
            (await db.UserVerbs.CountAsync(v => v.VerbId == verbId)).Should().Be(1);
            (await db.VerbFormProgresses.SingleAsync(p => p.VerbId == verbId)).Step.Should().Be(2);
            return 0;
        });

        var again = await InScope(sp => sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));
        again.Written.Should().Be(0);
    }

    [Test]
    public void Name_of_the_action_written_by_hand_names_its_sources()
    {
        foreach (var verb in JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray().Select(v => v!.AsObject()))
        {
            var lemma = verb["lemma"]!.GetValue<string>();
            verb["title"]!.GetValue<string>().Should().NotBe(lemma, $"{lemma}: the card title is the name of the action, not the dictionary form");
            if (verb["titleSources"] is JsonArray sources)
            {
                sources.Count.Should().BeGreaterThanOrEqualTo(2, $"{lemma}: a title written by hand is checked against two sources");
                sources.Select(s => s!.GetValue<string>()).Should().OnlyContain(url => url.StartsWith("http"));
            }
        }
    }

    [Test]
    public async Task Moving_a_verb_in_the_catalog_updates_its_position_without_rewriting_forms()
    {
        var catalog = JsonNode.Parse(CatalogJson())!;
        var verbs = catalog["verbs"]!.AsArray();
        var last = verbs[^1]!;
        var lastLemma = last["lemma"]!.GetValue<string>();
        var formIdsBefore = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms
            .Where(f => f.Verb.Lemma == lastLemma).Select(f => f.Id).OrderBy(id => id).ToListAsync());
        verbs.RemoveAt(verbs.Count - 1);
        verbs.Insert(0, last);

        var result = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog.ToJsonString(), CancellationToken.None));
        var list = await InScope(sp => sp.GetRequiredService<VerbQueries>().ListAsync(CancellationToken.None));
        var formIdsAfter = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms
            .Where(f => f.Verb.Lemma == lastLemma).Select(f => f.Id).OrderBy(id => id).ToListAsync());

        result.Written.Should().Be(0, because: "the catalog is ordered by frequency, so one new verb shifts many — that must stay cheap");
        list.Select(v => v.Lemma).Should().Equal(verbs.Select(v => v!["lemma"]!.GetValue<string>()));
        formIdsAfter.Should().Equal(formIdsBefore);
    }

    [Test]
    public async Task Verb_struck_out_of_the_catalog_is_removed_with_its_forms()
    {
        var catalog = JsonNode.Parse(CatalogJson())!;
        var verbs = catalog["verbs"]!.AsArray();
        var struck = verbs[^1]!["lemma"]!.GetValue<string>();
        var itsForm = verbs[^1]!["tenses"]!["present"]![0]![0]!.GetValue<string>();
        var formsOfOthers = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms
            .CountAsync(f => f.Verb.Lemma != struck));
        verbs.RemoveAt(verbs.Count - 1);

        var result = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog.ToJsonString(), CancellationToken.None));
        var card = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync(struck, CancellationToken.None));
        var hits = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(itsForm, CancellationToken.None));
        var formsLeft = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms.CountAsync());

        result.Removed.Should().Be(1);
        result.Written.Should().Be(0);
        card.Should().BeNull(because: "a verb is struck out when its forms are wrong — it must stop being served as verified");
        hits.Should().NotContain(h => h.Lemma == struck);
        formsLeft.Should().Be(formsOfOthers);
    }

    [Test]
    public async Task Verbs_that_did_not_come_from_the_catalog_survive_seeding()
    {
        // Forms are borrowed from a catalog verb: the test must not invent Georgian.
        var donor = JsonNode.Parse(CatalogJson())!["verbs"]![0]!;
        var form = donor["tenses"]!["present"]![0]![0]!.GetValue<string>();
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            foreach (var (lemma, status) in new[] { ("generated-verb", VerbStatus.Generated), ("approved-verb", VerbStatus.Verified) })
            {
                var id = Guid.NewGuid();
                db.Verbs.Add(new Verb
                {
                    Id = id, Lemma = lemma, Title = lemma, Translation = "не из каталога", Kind = "pattern",
                    PresentJson = "[]", CardJson = "{}", ContentHash = "made-elsewhere", Status = status,
                    SortOrder = 10_000, CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
                });
                db.VerbForms.Add(new VerbForm { Id = Guid.NewGuid(), VerbId = id, Form = form, Tense = "present", Person = 0 });
            }

            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var result = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));
        var survivors = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs
            .Where(v => v.Lemma == "generated-verb" || v.Lemma == "approved-verb").Include(v => v.Forms).ToListAsync());

        result.Removed.Should().Be(0, because: "only verbs the seeder itself wrote are its to delete");
        survivors.Should().HaveCount(2);
        survivors.Should().OnlyContain(v => v.Forms.Count == 1);
    }

    [Test]
    public async Task Model_made_verb_whose_lemma_joins_the_catalog_becomes_verified_in_place()
    {
        // The state before a release that adds a verb to the catalog: a user had asked for it earlier,
        // so the row exists as model-made, with its own forms. The lemma is a real catalog one.
        var entry = JsonNode.Parse(CatalogJson())!["verbs"]![0]!;
        var lemma = entry["lemma"]!.GetValue<string>();
        var someForm = entry["tenses"]!["present"]![0]![0]!.GetValue<string>();
        var id = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = await db.Verbs.Include(v => v.Forms).SingleAsync(v => v.Lemma == lemma);
            db.VerbForms.RemoveRange(verb.Forms);
            db.VerbForms.Add(new VerbForm { Id = Guid.NewGuid(), VerbId = verb.Id, Form = someForm, Tense = "present", Person = 5 });
            verb.Status = VerbStatus.Generated;
            verb.ContentHash = "made-by-a-model";
            verb.CardJson = "{}";
            await db.SaveChangesAsync(CancellationToken.None);
            return verb.Id;
        });

        var result = await InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));
        var after = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs
            .Include(v => v.Forms).SingleAsync(v => v.Lemma == lemma));
        var card = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync(lemma, CancellationToken.None));

        result.Written.Should().Be(1);
        after.Id.Should().Be(id, because: "what learners already have on this verb points at the row and must survive");
        after.Status.Should().Be(VerbStatus.Verified);
        after.ContentHash.Should().StartWith(VerbCatalogSeeder.CatalogMark);
        after.Forms.Should().NotContain(f => f.Person == 5 && f.Form == someForm, because: "the model's forms are replaced by the catalog's");
        after.Forms.Count.Should().BeGreaterThan(6);
        JsonNode.Parse(card!)!["status"]!.GetValue<string>().Should().Be("verified");
    }

    [Test]
    public async Task Empty_catalog_is_rejected_instead_of_wiping_the_verbs()
    {
        var seed = () => InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync("{\"verbs\":[]}", CancellationToken.None));

        await seed.Should().ThrowAsync<InvalidOperationException>();
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.CountAsync())).Should().BeGreaterThan(0);
    }

    /// <summary>scripts/verbs of the repository the tests are run from.</summary>
    private static string ScriptsFile(string name)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !File.Exists(Path.Combine(directory.FullName, "scripts", "verbs", name)))
        {
            directory = directory.Parent;
        }

        return Path.Combine(directory!.FullName, "scripts", "verbs", name);
    }

    private static string? StopWordIn(string text, JsonNode stoplist)
    {
        const string letter = "а-яёa-zა-ჰ";
        var lower = text.ToLowerInvariant();
        string Escaped(JsonNode? word) => System.Text.RegularExpressions.Regex.Escape(word!.GetValue<string>().ToLowerInvariant());
        return stoplist["prefixes"]!.AsArray().Select(Escaped)
                   .FirstOrDefault(w => System.Text.RegularExpressions.Regex.IsMatch(lower, $"(^|[^{letter}]){w}"))
               ?? stoplist["words"]!.AsArray().Select(Escaped)
                   .FirstOrDefault(w => System.Text.RegularExpressions.Regex.IsMatch(lower, $"(^|[^{letter}]){w}($|[^{letter}])"));
    }

    [Test]
    public void Example_sentences_have_no_word_of_the_stop_list()
    {
        // The list is the owner's (scripts/verbs/sentences.stoplist.json): countries and topics that
        // have no place in a learner's examples. The catalog build has the same gate.
        var stoplist = JsonNode.Parse(File.ReadAllText(ScriptsFile("sentences.stoplist.json")))!;
        var allowed = stoplist["allow"]!.AsObject().Select(a => a.Key).ToHashSet();

        var found = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray()
            .SelectMany(v => v!["sentences"]!.AsArray())
            .Where(s => !allowed.Contains(s!["id"]!.GetValue<long>().ToString()))
            .Select(s => (Sentence: $"{s!["id"]} {s["ka"]} — {s["ru"]}", Word: StopWordIn($"{s["ka"]} {s["ru"]}", stoplist)))
            .Where(x => x.Word != null)
            .Select(x => $"{x.Sentence} [{x.Word}]")
            .Distinct()
            .ToList();

        JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray().SelectMany(v => v!["sentences"]!.AsArray())
            .Where(s => s!["id"]!.GetValue<long>() < 0)
            .Should().OnlyContain(s => s!["source"] != null, "a sentence written in by hand names where its Georgian comes from");
        found.Should().BeEmpty("strike the sentence out in scripts/verbs/sentences.skip.json and rebuild the catalog");
    }

    [TestCase("Я из России.", "росси")]
    [TestCase("მე რუსეთიდან ვარ.", "რუსეთ")]
    [TestCase("Мы победили врага.", "враг")]
    [TestCase("Кто будет нашим следующим президентом?", "президент")]
    [TestCase("Русские идут.", "русские")]
    [TestCase("ფილმი ომის შესახებ არის", "ომის")]
    [TestCase("Том положил свой пистолет под подушку.", "пистолет")]
    [TestCase("Она знает, кто убил её собаку.", "убил")]
    [TestCase("Вы были арестованы?", "арестован")]
    [TestCase("Откройте дверь, или мы её взломаем!", "взлома")]
    [TestCase("Вы это украли?", "украл")]
    [TestCase("Вы думаете, что Том умер?", "умер")]
    [TestCase("Вы потеряли много крови?", "крови")]
    [TestCase("Климат здесь умеренный.", null)]
    [TestCase("Я умею плавать.", null)]
    [TestCase("Где моя кровать?", null)]
    [TestCase("Кровля протекает.", null)]
    [TestCase("Том слишком много выпил.", null)]
    [TestCase("Я хочу меч!", null)]
    [TestCase("Вы говорите по-русски?", null)]
    [TestCase("Я учу русский язык.", null)]
    [TestCase("ლაპარაკობ რუსულად?", null)]
    [TestCase("ლომი დიდია.", null)]
    [TestCase("Это двойной звук.", null)]
    [TestCase("Я из Испании.", null)]
    public void Stop_list_catches_the_topic_and_not_the_language_or_a_word_that_only_contains_the_letters(string text, string? word)
    {
        var stoplist = JsonNode.Parse(File.ReadAllText(ScriptsFile("sentences.stoplist.json")))!;

        StopWordIn(text, stoplist).Should().Be(word);
    }

    [Test]
    public void I_am_has_a_neutral_example_with_that_very_form()
    {
        var be = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray().Single(v => v!["ru"]!.GetValue<string>() == "быть")!;
        var i = be["tenses"]!["present"]![0]![0]!.GetValue<string>();

        var examples = be["sentences"]!.AsArray().Where(s => s!["form"]!.GetValue<string>() == i).ToList();

        examples.Should().NotBeEmpty();
        var spain = examples.Single(s => s!["ru"]!.GetValue<string>() == "Я из Испании.")!;
        System.Text.RegularExpressions.Regex.Matches(spain["ka"]!.GetValue<string>(), "[ა-ჰ]+").Select(m => m.Value).Should().Contain(i);
        spain["source"]!.GetValue<string>().Should().Contain("MiniAppContentProvider.cs", because: "a sentence written in by hand names where its Georgian comes from");
        examples.Select(s => s!["ru"]!.GetValue<string>()).Should().NotContain(ru => ru.Contains("Росси"));
    }

    [Test]
    public async Task Example_replaced_in_the_catalog_reaches_a_base_seeded_before()
    {
        // The base as it was seeded before: «быть» had another example where the new one is now.
        var before = JsonNode.Parse(CatalogJson())!;
        var be = before["verbs"]!.AsArray().Single(v => v!["ru"]!.GetValue<string>() == "быть")!;
        var lemma = be["lemma"]!.GetValue<string>();
        var replaced = be["sentences"]!.AsArray().Single(s => s!["id"]!.GetValue<long>() < 0)!.AsObject();
        replaced["id"] = 2229216;
        replaced["ru"] = "прежний пример";
        replaced.Remove("source");
        var verbId = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(before.ToJsonString(), CancellationToken.None);
            var row = await db.Verbs.AsNoTracking().SingleAsync(v => v.Lemma == lemma);
            row.CardJson.Should().Contain("прежний пример");
            return row.Id;
        });

        // The next start of the server: the catalog as it is now.
        var result = await InScope(sp => sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(CatalogJson(), CancellationToken.None));

        result.Written.Should().Be(1, because: "only the verb whose examples changed is rewritten");
        var card = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync(lemma, CancellationToken.None));
        card.Should().Contain("Я из Испании.").And.NotContain("прежний пример");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.AsNoTracking().SingleAsync(v => v.Lemma == lemma)))
            .Id.Should().Be(verbId, because: "the row is updated in place, so what learners have stays attached");
    }

    [Test]
    public void Catalog_is_what_the_build_gates_promise()
    {
        var verbs = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray();
        var georgian = new System.Text.RegularExpressions.Regex("^[ა-ჰ]+$");

        verbs.Count.Should().BeGreaterThan(150, because: "the catalog is meant to cover the common verbs, not a handful");
        verbs.Select(v => v!["lemma"]!.GetValue<string>()).Should().OnlyHaveUniqueItems();
        foreach (var verb in verbs)
        {
            var lemma = verb!["lemma"]!.GetValue<string>();
            verb["ru"]!.GetValue<string>().Should().NotBeNullOrWhiteSpace($"{lemma} needs a Russian gloss");
            var tables = new[] { verb["tenses"]!.AsObject() }.Concat(verb["alt"]!.AsArray().Select(t => t!.AsObject()));
            foreach (var (tense, row) in tables.SelectMany(t => t))
            {
                row!.AsArray().Should().HaveCount(6, $"{lemma}.{tense} is a row of six persons");
                row.AsArray().SelectMany(cell => cell!.AsArray()).Select(f => f!.GetValue<string>())
                    .Should().OnlyContain(f => georgian.IsMatch(f), $"{lemma}.{tense} holds Georgian forms only");
            }

            verb["tenses"]!["present"]!.AsArray().Should().OnlyContain(cell => cell!.AsArray().Count > 0,
                $"{lemma}: the list row and the card header are built from the present tense");
        }
    }

    [Test]
    public async Task List_keeps_catalog_order_and_carries_the_present_form()
    {
        var catalog = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray();

        var list = await InScope(sp => sp.GetRequiredService<VerbQueries>().ListAsync(CancellationToken.None));

        list.Select(v => v.Lemma).Should().Equal(catalog.Select(v => v!["lemma"]!.GetValue<string>()));
        var write = list.Single(v => v.Lemma == "წერს");
        write.Title.Should().Be("წერა");
        JsonSerializer.Deserialize<string[]>(write.PresentJson).Should().Equal("ვწერ");
    }

    [Test]
    public async Task Card_is_stored_in_the_shape_the_miniapp_reads()
    {
        var json = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("მიდის", CancellationToken.None));

        var card = JsonNode.Parse(json!)!;
        card["id"]!.GetValue<string>().Should().Be("მიდის");
        card["kind"]!.GetValue<string>().Should().Be("special");
        card["tenses"]!["future"]![0]![0]!.GetValue<string>().Should().Be("წავალ",
            because: "'to go' takes the წა- preverb in the future, the way it is taught in lessons");
        card["oddTenses"]!.AsArray().Should().NotBeEmpty();
        json.Should().Contain("წავალ", because: "Georgian must be stored readable, not as \\u escapes");
    }

    [Test]
    public async Task Card_says_what_each_main_form_means_in_plain_Russian()
    {
        var want = JsonNode.Parse((await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("უნდა", CancellationToken.None)))!)!;
        var write = JsonNode.Parse((await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("წერს", CancellationToken.None)))!)!;

        want["meanings"]!["present"]!.AsArray().Select(m => m!.GetValue<string>())
            .Should().Equal("я хочу", "ты хочешь", "он хочет", "мы хотим", "вы хотите", "они хотят");
        want["meanings"]!["imperfect"]![0]!.GetValue<string>().Should().Be("я хотел(а)");
        want["meaningChips"]!.AsObject().Should().BeEmpty(because: "with two tenses no phrase repeats, so no note is needed");

        write["meanings"]!["future"]![3]!.GetValue<string>().Should().Be("мы будем писать");
        write["meanings"]!.AsObject().Select(t => t.Key).Should().BeEquivalentTo(
            new[] { "present", "aorist", "imperfect", "optative", "conditional", "future" },
            because: "rare tenses are not in exercises and get no phrase");
        write["meaningChips"]!["aorist"]!.GetValue<string>().Should().Be("один раз · сделано");
        write["meaningChips"]!["imperfect"]!.GetValue<string>().Should().Be("долго или часто");
    }

    [Test]
    public async Task Every_main_tense_form_row_has_a_meaning_and_rare_tense_rows_have_none()
    {
        var main = new[] { "present", "aorist", "imperfect", "optative", "conditional", "future" };

        var rows = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VerbForms
            .Select(f => new { f.Tense, f.Meaning, f.MeaningNote }).ToListAsync());

        rows.Where(r => main.Contains(r.Tense)).Should().OnlyContain(r => !string.IsNullOrEmpty(r.Meaning));
        rows.Where(r => !main.Contains(r.Tense)).Should().OnlyContain(r => r.Meaning == null && r.MeaningNote == null);
    }

    [Test]
    public async Task Form_of_a_parallel_table_means_the_same_as_its_cell_in_the_main_one()
    {
        // მივიდა is the aorist of "to go" with another preverb than the main table's წავიდა.
        var hits = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync("მივიდა", CancellationToken.None));

        hits.Single(h => h.Lemma == "მიდის").Should().BeEquivalentTo(
            new { Tense = "aorist", Person = 2, Meaning = "он шёл", MeaningNote = "один раз · сделано" });
    }

    [Test]
    public async Task Card_carries_the_review_status_taken_from_the_row()
    {
        var verified = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("წერს", CancellationToken.None));
        JsonNode.Parse(verified!)!["status"]!.GetValue<string>().Should().Be("verified");

        // A verb that a model produced is served with its own status even though the stored card is the same.
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = await db.Verbs.SingleAsync(v => v.Lemma == "წერს");
            verb.Status = VerbStatus.Generated;
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var generated = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("წერს", CancellationToken.None));
        JsonNode.Parse(generated!)!["status"]!.GetValue<string>().Should().Be("generated",
            because: "the verb view says where a model-made verb came from");
    }

    [Test]
    public async Task Unknown_verb_has_no_card()
    {
        var json = await InScope(sp => sp.GetRequiredService<VerbQueries>().GetCardJsonAsync("არარსებული", CancellationToken.None));

        json.Should().BeNull();
    }

    [Test]
    public async Task Parse_finds_the_form_with_its_tense_and_person()
    {
        var hits = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(" ვწერდი ", CancellationToken.None));

        // The same form also belongs to "to write to someone" (სწერს); the more common verb comes first.
        hits[0].Should().BeEquivalentTo(
            new VerbFormHit("ვწერდი", "წერს", "წერა", "писать", "imperfect", 0, "я писал(а)", "долго или часто"),
            because: "a hit says the form in plain Russian; the note tells it from the other past that reads the same");
        hits.Should().OnlyContain(h => h.Form == "ვწერდი" && h.Tense == "imperfect" && h.Person == 0);
        hits.Select(h => h.Lemma).Should().OnlyHaveUniqueItems();
    }

    [Test]
    public async Task Parse_finds_forms_of_both_preverb_variants_of_to_go()
    {
        var withTsa = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync("წავიდა", CancellationToken.None));
        var withMi = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync("მივიდა", CancellationToken.None));

        withTsa.Should().Contain(h => h.Lemma == "მიდის" && h.Tense == "aorist" && h.Person == 2);
        withMi.Should().Contain(h => h.Lemma == "მიდის" && h.Tense == "aorist" && h.Person == 2);
    }

    [Test]
    public async Task Parse_of_an_unknown_or_oversized_form_is_empty()
    {
        var unknown = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync("ხაჭაპური", CancellationToken.None));
        var oversized = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(new string('ა', 500), CancellationToken.None));

        unknown.Should().BeEmpty();
        oversized.Should().BeEmpty();
    }

    [Test]
    public async Task Verbs_endpoints_require_authentication()
    {
        var client = _testServer.CreateClient();

        var list = await client.GetAsync("/api/miniapp/verbs");
        var card = await client.GetAsync("/api/miniapp/verbs/წერს");
        var parse = await client.GetAsync("/api/miniapp/verbs/parse?form=ვწერ");

        list.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
        card.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
        parse.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task Verb_inside_a_dictionary_word_or_phrase_is_found_in_one_batch()
    {
        var texts = new[] { "მივდივარ", "მე მივდივარ სკოლაში", "хлеб", "პური", "я пошёл" };

        var hits = await InScope(sp => sp.GetRequiredService<VerbQueries>().FindInTextsAsync(texts, CancellationToken.None));

        hits.Keys.Should().BeEquivalentTo("მივდივარ", "მე მივდივარ სკოლაში");
        hits["მე მივდივარ სკოლაში"].Should().BeEquivalentTo(
            new VerbFormHit("მივდივარ", "მიდის", "სვლა", "идти, уходить", "present", 0, "я иду"),
            because: "a phrase is marked by the verb form it contains, with that form's tense and person");
    }

    [Test]
    public async Task Form_spelled_like_an_unrelated_word_is_not_parsed_as_the_verb()
    {
        // The catalog marks such forms per verb; the test takes one from the data rather than naming it.
        var marked = JsonNode.Parse(CatalogJson())!["verbs"]!.AsArray()
            .First(v => v!["notForParse"]!.AsArray().Count > 0)!;
        var form = marked["notForParse"]![0]!.GetValue<string>();
        var lemma = marked["lemma"]!.GetValue<string>();

        var hits = await InScope(sp => sp.GetRequiredService<VerbQueries>().ParseAsync(form, CancellationToken.None));
        var inPhrase = await InScope(sp => sp.GetRequiredService<VerbQueries>().FindInTextsAsync(new[] { form }, CancellationToken.None));

        hits.Should().NotContain(h => h.Lemma == lemma,
            because: "a word that is also a common non-verb must not get a «глагол» badge on the strength of spelling alone");
        inPhrase.Values.Should().NotContain(h => h.Lemma == lemma);
    }
}
