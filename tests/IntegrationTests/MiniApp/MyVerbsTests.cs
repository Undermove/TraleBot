using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The verb as a first-class dictionary entry: which entries are a verb form alone, how saved forms
/// of one verb fold into one verb, how verbs started elsewhere join "my verbs", and what a correct
/// answer in the generic vocabulary quiz does for the verb — against real Postgres.
/// Georgian forms are the ones the catalog tests already use.
/// </summary>
public class MyVerbsTests : TestBase
{
    private const string Write = "წერს";
    private const string Go = "მიდის";
    private const string IWrote = "ვწერდი";      // imperfect, я
    private const string IWrite = "ვწერ";         // present, я
    private const string GoPhrase = "მე მივდივარ სკოლაში";
    private static readonly DateTime Now = new(2026, 10, 5, 18, 0, 0, DateTimeKind.Utc);

    private User _user = null!;

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = _testServer.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    private Task<VocabularyEntry> Add(string word, string definition) => InScope(async sp =>
    {
        var entry = new VocabularyEntry
        {
            Id = Guid.NewGuid(), Word = word, Definition = definition, AdditionalInfo = "", Example = "",
            DateAddedUtc = Now, UpdatedAtUtc = Now, UserId = _user.Id, Language = Language.Georgian
        };
        var db = sp.GetRequiredService<ITraleDbContext>();
        db.VocabularyEntries.Add(entry);
        await db.SaveChangesAsync(CancellationToken.None);
        return entry;
    });

    private Task<MyVerbs> MyVerbs(params (string Word, string Definition)[] entries) =>
        InScope(sp => sp.GetRequiredService<MyVerbsQuery>().GetAsync(_user.Id, entries, CancellationToken.None));

    private Task<int> Credit(Guid wordId, DateTime? at = null) => InScope(async sp =>
    {
        await sp.GetRequiredService<VerbQuizCreditService>().CreditCorrectAnswerAsync(_user, wordId, at ?? Now, CancellationToken.None);
        return 0;
    });

    private Task<VerbProgressState?> Progress(string lemma) =>
        InScope(sp => sp.GetRequiredService<VerbProgressService>().GetAsync(_user.Id, lemma, Now, CancellationToken.None));

    private Task<int> Play(string lemma, DateTime at, params VerbFormStep[] forms) => InScope(async sp =>
    {
        var report = new VerbSessionReport(Guid.NewGuid(), """{"scenes":[]}""", 0, 0, forms, true, new[] { "meet" }, false, 0, 0);
        await sp.GetRequiredService<VerbLearningService>().SaveAsync(_user, lemma, report, 11, at, CancellationToken.None);
        return 0;
    });

    [SetUp]
    public async Task SeedCatalogAndUser()
    {
        _user = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            var catalog = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));
            await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalog, CancellationToken.None);

            var user = Create.User(Random.Shared.NextInt64(1, long.MaxValue), "Learner");
            db.Users.Add(user);
            await db.SaveChangesAsync(CancellationToken.None);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            await db.SaveChangesAsync(CancellationToken.None);
            return await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == user.Id);
        });
    }

    [Test]
    public async Task Entry_that_is_one_verb_form_is_single_and_a_phrase_with_a_verb_is_not()
    {
        var mine = await MyVerbs((IWrote, "я писал"), ("писать", IWrite), (GoPhrase, "я иду в школу"), ("стол", "მაგიდა"));

        mine.Entries[0].Should().BeEquivalentTo(new { Single = true, Level = VerbLevel.New, Hit = new { Lemma = Write, Form = IWrote, Tense = "imperfect", Person = 0 } });
        mine.Entries[1]!.Single.Should().BeTrue("the Georgian side may be stored as the definition");
        mine.Entries[2].Should().BeEquivalentTo(new { Single = false, Hit = new { Lemma = Go } });
        mine.Entries[3].Should().BeNull();
    }

    [Test]
    public async Task Several_saved_forms_of_one_verb_are_one_verb()
    {
        var mine = await MyVerbs((IWrote, "я писал"), (IWrite, "я пишу"), (IWrite, "пишу"), (GoPhrase, "я иду в школу"));

        mine.Verbs.Select(v => v.Lemma).Should().Equal(Write, Go);
        mine.Verbs[0].SavedForms.Select(f => f.Form).Should().Equal(IWrote, IWrite);
        mine.Verbs[0].Should().BeEquivalentTo(new { Started = false, Level = VerbLevel.New });
    }

    [Test]
    public async Task Verb_started_outside_the_dictionary_joins_my_verbs_and_started_verbs_come_first()
    {
        await Play(Go, Now.AddMinutes(-5), new VerbFormStep("present", 0, 3, 0, Now.AddMinutes(-5)), new VerbFormStep("aorist", 0, 3, 0, Now.AddMinutes(-5)));

        var mine = await MyVerbs((IWrote, "я писал"));

        mine.Verbs.Select(v => (v.Lemma, v.Started)).Should().Equal((Go, true), (Write, false));
        mine.Verbs[0].Level.Should().Be(VerbLevel.Recognising);
        mine.Verbs[0].SavedForms.Should().BeEmpty("it was started from a lesson or a translation, not saved");
    }

    [Test]
    public async Task Dictionary_entry_of_a_started_verb_shows_that_verbs_level()
    {
        await Play(Write, Now, new VerbFormStep("present", 0, 3, 0, Now), new VerbFormStep("aorist", 0, 3, 0, Now));

        (await MyVerbs((IWrote, "я писал"))).Entries[0]!.Level.Should().Be(VerbLevel.Recognising);
    }

    [Test]
    public async Task Dashboard_offers_the_most_recently_played_verb_that_is_not_learned()
    {
        (await InScope(sp => sp.GetRequiredService<MyVerbsQuery>().ContinueAsync(_user.Id, CancellationToken.None))).Should().BeNull();

        await Play(Write, Now.AddHours(-2), new VerbFormStep("present", 0, 2, 0, Now.AddHours(-2)));
        await Play(Go, Now.AddHours(-1), new VerbFormStep("present", 0, 2, 0, Now.AddHours(-1)));

        var next = await InScope(sp => sp.GetRequiredService<MyVerbsQuery>().ContinueAsync(_user.Id, CancellationToken.None));
        next.Should().BeEquivalentTo(new { Lemma = Go, Level = VerbLevel.Meeting, Started = true });
    }

    // ── The generic vocabulary quiz and single-form verb entries ─────────────

    [Test]
    public async Task Correct_quiz_answer_on_a_verb_form_entry_moves_that_form_and_makes_the_verb_mine()
    {
        var entry = await Add(IWrote, "я писал");

        await Credit(entry.Id);

        var form = (await Progress(Write))!.Forms.Should().ContainSingle().Subject;
        form.Should().BeEquivalentTo(new { Tense = "imperfect", Person = 0, Step = 1 });
        var mine = await MyVerbs((IWrote, "я писал"));
        mine.Verbs.Should().ContainSingle().Which.Should().BeEquivalentTo(new { Lemma = Write, Started = true, Level = VerbLevel.Meeting });
    }

    [Test]
    public async Task Quiz_credit_is_recognition_only_and_stops_at_a_solid_form()
    {
        var entry = await Add(IWrote, "я писал");

        for (var i = 0; i < 6; i++)
        {
            // Each answer comes later than the previous one: form saves are last-write-wins by answer time.
            await Credit(entry.Id, Now.AddSeconds(i));
        }

        (await Progress(Write))!.Forms.Single().Step.Should().Be(VerbLevelRules.SolidStep);
    }

    [Test]
    public async Task Quiz_answers_on_a_phrase_a_plain_word_or_someone_elses_entry_do_not_touch_verbs()
    {
        var phrase = await Add(GoPhrase, "я иду в школу");
        var word = await Add("стол", "მაგიდა");

        await Credit(phrase.Id);
        await Credit(word.Id);
        await Credit(Guid.NewGuid());

        (await Progress(Go))!.Forms.Should().BeEmpty();
        (await Progress(Write))!.Forms.Should().BeEmpty();
        (await MyVerbs()).Verbs.Should().BeEmpty();
    }
}
