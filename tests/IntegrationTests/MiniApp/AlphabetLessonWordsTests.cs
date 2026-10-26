using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Trale.MiniApp;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The words of a counted alphabet lesson go into the learner's dictionary over HTTP, against real Postgres:
/// only after the lesson counted, without a subscription, once; and the server's list is the lesson theory's.
/// </summary>
public class AlphabetLessonWordsTests : TestBase
{
    private const long Owner = 4_400_000_777;
    private static long _nextTelegramId = 7_100_000_000;

    private TraleTestApplication _app = null!;
    private long _telegramId;
    private Guid _userId;

    [OneTimeSetUp]
    public void StartSignedApp() => _app = _testServer.WithSignedLogin(Owner);

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CreateFreeLearner()
    {
        _telegramId = Interlocked.Increment(ref _nextTelegramId);
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = Create.User(_telegramId, "Learner");
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        _userId = user.Id;
    }

    private async Task<HttpResponseMessage> Post(string path, object body)
    {
        using var client = _app.ClientFor(_telegramId);
        return await client.PostAsJsonAsync($"/api/miniapp/{path}", body);
    }

    private async Task<List<VocabularyEntry>> Dictionary()
    {
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        return await db.VocabularyEntries.AsNoTracking().Where(e => e.UserId == _userId).ToListAsync();
    }

    [Test]
    public async Task A_counted_words_lesson_puts_its_words_into_the_dictionary_once()
    {
        // Урок слов 12 идёт после урока букв 1: და, არა, რა.
        (await Post("progress/lesson-complete", new { moduleId = "alphabet-progressive", lessonId = 12, correct = 4, total = 4 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await Post("vocabulary/alphabet-words", new { lessonId = 12 });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        body["added"]!.GetValue<int>().Should().Be(3);
        body["words"]!.AsArray().Select(w => w!["word"]!.GetValue<string>()).Should().Equal("და", "არა", "რა");

        var entries = await Dictionary();
        entries.Select(e => (e.Word, e.Definition)).Should().BeEquivalentTo(new[] { ("და", "и"), ("არა", "нет"), ("რა", "что") });
        entries.Should().OnlyContain(e => e.Language == Language.Georgian);

        var again = JsonNode.Parse(await (await Post("vocabulary/alphabet-words", new { lessonId = 12 })).Content.ReadAsStringAsync())!;
        again["added"]!.GetValue<int>().Should().Be(0);
        (await Dictionary()).Should().HaveCount(3);
    }

    [Test]
    public async Task A_lesson_that_did_not_count_adds_nothing()
    {
        // Two mistakes out of four: the alphabet forgives only one.
        (await Post("progress/lesson-complete", new { moduleId = "alphabet-progressive", lessonId = 12, correct = 2, total = 4 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await Post("vocabulary/alphabet-words", new { lessonId = 12 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Post("vocabulary/alphabet-words", new { lessonId = 99 })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Dictionary()).Should().BeEmpty();
    }

    [Test]
    public async Task A_lesson_passed_with_one_slip_still_puts_its_words_into_the_dictionary()
    {
        (await Post("progress/lesson-complete", new { moduleId = "alphabet-progressive", lessonId = 12, correct = 3, total = 4 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await Post("vocabulary/alphabet-words", new { lessonId = 12 })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Dictionary()).Should().HaveCount(3);
    }

    [Test]
    public async Task A_counted_intro_lesson_puts_its_phrases_and_scene_words_into_the_dictionary()
    {
        // Урок 3 «Знакомства»: როგორ ხარ?, კარგად, მადლობა и слова сцены пекарни.
        var words = new IntroLessonWords().WordsOf(3);
        (await Post("progress/lesson-complete", new { moduleId = "intro", lessonId = 3, correct = 5, total = 5 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var body = JsonNode.Parse(await (await Post("vocabulary/intro-words", new { lessonId = 3 })).Content.ReadAsStringAsync())!;
        body["words"]!.AsArray().Select(w => w!["word"]!.GetValue<string>()).Should().Equal(words.Select(w => w.Word));
        words.Select(w => w.Word).Should().Contain(["როგორ ხარ?", "პური"]);
        (await Dictionary()).Select(e => e.Word).Should().BeEquivalentTo(words.Select(w => w.Word));

        (await Post("vocabulary/intro-words", new { lessonId = 4 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Post("vocabulary/intro-words", new { lessonId = 99 })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task The_server_word_list_is_the_lesson_theory()
    {
        var words = new AlphabetLessonWords();
        using var client = _testServer.CreateClient();
        using var doc = JsonDocument.Parse(await client.GetStringAsync("/api/miniapp/content"));
        var lessons = doc.RootElement.GetProperty("modules").EnumerateArray()
            .Single(m => m.GetProperty("id").GetString() == "alphabet-progressive")
            .GetProperty("lessons").EnumerateArray().ToList();

        // Порядок: урок букв, за ним его уроки слов; у уроков букв id 1..11 — прогресс людей не меняется.
        lessons.Should().HaveCount(31);
        lessons.Select(l => l.GetProperty("id").GetInt32()).Where(id => id <= 11).Should().Equal(Enumerable.Range(1, 11));
        var total = 0;
        foreach (var lesson in lessons.Where(l => l.GetProperty("id").GetInt32() <= 11))
        {
            var id = lesson.GetProperty("id").GetInt32();
            var items = TheoryWords(lesson);
            var listed = words.WordLessons.Where(w => w.After == id).SelectMany(w => w.Words).ToList();
            words.WordLessons.Where(w => w.After == id).Should().OnlyContain(w => w.Words.Count >= 2 && w.Words.Count <= 4, "every new word gets its own scene: at most 4 per lesson");
            listed.Should().NotBeEmpty($"lesson {id} has words in its theory");
            listed.Should().HaveCount(items.Count, $"lesson {id}: every word of the theory, nothing else");
            foreach (var w in listed)
            {
                items.Should().Contain(i => i.StartsWith($"{w.Word} — ", StringComparison.Ordinal) && i.Contains(w.Translation, StringComparison.Ordinal),
                    $"lesson {id}: «{w.Word} — {w.Translation}» comes from the theory");
            }
            total += listed.Count;
        }
        total.Should().Be(69);
    }

    /// <summary>The list right after the «Грузинские слова урока:» paragraph.</summary>
    private static List<string> TheoryWords(JsonElement lesson)
    {
        var blocks = lesson.GetProperty("theory").GetProperty("blocks").EnumerateArray().ToList();
        var at = blocks.FindIndex(b => b.ToString().Contains("Грузинские слова урока"));
        at.Should().BeGreaterThanOrEqualTo(0);
        var list = blocks[at + 1];
        return list.GetProperty("items").EnumerateArray().Select(i => i.GetString()!).ToList();
    }
}
