using System.Text.Json.Nodes;
using Application.Common;
using Application.Verbs;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Trale.MiniApp;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Verbs as a layer over lessons: questions of a real lesson get the parse of the catalog verb
/// they are about, so the mini-app can offer the verb card after the answer. Real lesson JSON,
/// real catalog, real Postgres. All Georgian here is taken from those two files.
/// </summary>
public class LessonVerbAnnotationTests : TestBase
{
    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        using var scope = _testServer.Services.CreateScope();
        return await action(scope.ServiceProvider);
    }

    [SetUp]
    public async Task SeedCatalog()
    {
        var catalogJson = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Verbs", "verbs.json"));
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.ToListAsync());
            await db.SaveChangesAsync(CancellationToken.None);
            return await sp.GetRequiredService<VerbCatalogSeeder>().SeedAsync(catalogJson, CancellationToken.None);
        });
    }

    private static User Viewer(bool withAccess) => new()
    {
        Id = Guid.NewGuid(),
        TelegramId = Random.Shared.NextInt64(1, long.MaxValue),
        AccountType = UserAccountType.Free,
        // A fresh account is inside its trial; an old free one is not.
        RegisteredAtUtc = withAccess ? DateTime.UtcNow : DateTime.UtcNow.AddDays(-400),
        InitialLanguageSet = true,
        IsActive = true
    };

    /// <summary>
    /// The loader serves a random dozen of a lesson's questions per call, so one call may miss the
    /// question a test is about: draw until every wanted id has been seen and annotated.
    /// </summary>
    private async Task<Dictionary<string, VerbFormHit?>> AnnotateLesson(
        string moduleId, int lessonId, User? viewer, params string[] wantedIds)
    {
        var seen = new Dictionary<string, VerbFormHit?>();
        for (var draw = 0; draw < 200 && !wantedIds.All(seen.ContainsKey); draw++)
        {
            await InScope(async sp =>
            {
                var loader = sp.GetRequiredService<IGeorgianQuestionsLoaderFactory>()
                    .CreateForModuleLesson(ModuleRegistry.Get(moduleId)!.Directory, lessonId);
                var questions = loader.LoadQuestions();
                var hits = await sp.GetRequiredService<LessonVerbAnnotator>().AnnotateAsync(
                    viewer, questions.Select(LessonQuestionVerbs.ToTexts).ToList(), CancellationToken.None);
                for (var i = 0; i < questions.Count; i++)
                {
                    seen[questions[i].Id] = hits[i];
                }

                return 0;
            });
        }

        wantedIds.Should().OnlyContain(id => seen.ContainsKey(id), because: "the lesson must contain these questions");
        return seen;
    }

    [Test]
    public async Task Question_whose_answer_is_a_verb_form_is_annotated_with_its_tense_and_person()
    {
        var hits = await AnnotateLesson("present-tense", 1, Viewer(withAccess: true), "pr1_q01", "pr1_q03", "pr1_q06");

        hits["pr1_q01"].Should().BeEquivalentTo(new { Form = "ვარ", Lemma = "არის", Tense = "present", Person = 0 });
        hits["pr1_q03"].Should().BeEquivalentTo(new { Form = "არის", Lemma = "არის", Tense = "present", Person = 2 });
        hits["pr1_q06"].Should().BeEquivalentTo(new { Form = "არიან", Lemma = "არის", Tense = "present", Person = 5 });
    }

    [Test]
    public async Task Verb_that_stands_only_in_the_question_text_is_annotated_too()
    {
        // pr1_q08 asks to translate a Georgian sentence; the answer is Russian.
        var hits = await AnnotateLesson("present-tense", 1, Viewer(withAccess: true), "pr1_q08");

        hits["pr1_q08"].Should().BeEquivalentTo(new { Form = "ხარ", Lemma = "არის", Tense = "present", Person = 1 });
    }

    [Test]
    public async Task Question_without_a_catalog_verb_gets_no_annotation()
    {
        // pr1_q10 is about the negation particle: no verb form in the question or the answer.
        var hits = await AnnotateLesson("present-tense", 1, Viewer(withAccess: true), "pr1_q10");

        hits["pr1_q10"].Should().BeNull();
    }

    [Test]
    public async Task Verb_that_appears_only_among_wrong_options_is_not_annotated()
    {
        // pr3_q01 («я люблю»): the correct answer is a verb the catalog does not hold (its table does not
        // fit six persons), while both wrong options are forms of catalog verbs.
        var hits = await AnnotateLesson("present-tense", 3, Viewer(withAccess: true), "pr3_q01");

        hits["pr3_q01"].Should().BeNull(because: "a distractor's verb is not what the question is about");
    }

    [Test]
    public async Task Correct_answer_wins_over_a_verb_in_the_question_text()
    {
        var hits = await InScope(sp => sp.GetRequiredService<LessonVerbAnnotator>().AnnotateAsync(
            Viewer(withAccess: true),
            new[] { new LessonQuestionTexts(CorrectAnswer: "ვწერდი", BuiltSentence: null, Transcript: null, Question: "არის") },
            CancellationToken.None));

        hits.Should().ContainSingle().Which.Should().BeEquivalentTo(new { Lemma = "წერს", Tense = "imperfect", Person = 0 });
    }

    [Test]
    public async Task Nothing_is_annotated_without_trial_or_pro()
    {
        var withoutAccess = await AnnotateLesson("present-tense", 1, Viewer(withAccess: false), "pr1_q01");
        var anonymous = await AnnotateLesson("present-tense", 1, null, "pr1_q01");

        withoutAccess.Values.Should().OnlyContain(h => h == null,
            because: "the verb card is behind trial/Pro; a hint that opens a paywalled card would be a dead end in a free lesson");
        anonymous.Values.Should().OnlyContain(h => h == null);
    }

    [Test]
    public async Task Questions_endpoint_serves_the_lesson_to_an_anonymous_caller_without_verb_annotations()
    {
        var response = await _testServer.CreateClient()
            .GetStringAsync("/api/miniapp/modules/present-tense/lessons/1/questions");

        var questions = JsonNode.Parse(response)!.AsArray();
        questions.Should().NotBeEmpty();
        questions.Should().OnlyContain(q => q!.AsObject().ContainsKey("verb") && q["verb"] == null);
    }

    [Test]
    public async Task Dictionary_verbs_counts_only_own_entries_that_contain_a_verb_form()
    {
        var user = Viewer(withAccess: true);
        var count = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Users.Add(user);
            await db.SaveChangesAsync(CancellationToken.None);
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
            db.VocabularyEntries.Add(Entry(user, "ვწერდი", "я писал"));
            db.VocabularyEntries.Add(Entry(user, "писать", "წერს"));
            db.VocabularyEntries.Add(Entry(user, "стол", "მაგიდა"));
            await db.SaveChangesAsync(CancellationToken.None);

            var loaded = await db.Users.Include(u => u.Settings).SingleAsync(u => u.Id == user.Id);
            return await sp.GetRequiredService<DictionaryVerbsQuery>().CountAsync(loaded, CancellationToken.None);
        });

        count.Should().Be(2);
    }

    private static VocabularyEntry Entry(User user, string word, string definition) => new()
    {
        Id = Guid.NewGuid(),
        Word = word,
        Definition = definition,
        AdditionalInfo = string.Empty,
        Example = string.Empty,
        DateAddedUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
        UserId = user.Id,
        Language = Language.Georgian
    };
}
