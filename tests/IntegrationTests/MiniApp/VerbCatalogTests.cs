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
    public async Task Empty_catalog_is_rejected_instead_of_wiping_the_verbs()
    {
        var seed = () => InScope(sp =>
            sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync("{\"verbs\":[]}", CancellationToken.None));

        await seed.Should().ThrowAsync<InvalidOperationException>();
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Verbs.CountAsync())).Should().BeGreaterThan(0);
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
            because: "games built from the paradigm must not be offered for unreviewed verbs");
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
        hits[0].Should().BeEquivalentTo(new VerbFormHit("ვწერდი", "წერს", "წერა", "писать", "imperfect", 0));
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
            new VerbFormHit("მივდივარ", "მიდის", "სვლა", "идти, уходить", "present", 0),
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
