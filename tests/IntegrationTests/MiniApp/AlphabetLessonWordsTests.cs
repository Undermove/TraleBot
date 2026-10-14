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
    public async Task A_counted_lesson_puts_its_words_into_the_dictionary_once()
    {
        (await Post("progress/lesson-complete", new { moduleId = "alphabet-progressive", lessonId = 1, correct = 10, total = 10 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await Post("vocabulary/alphabet-words", new { lessonId = 1 });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        body["added"]!.GetValue<int>().Should().Be(3);
        body["words"]!.AsArray().Select(w => w!["word"]!.GetValue<string>()).Should().Equal("და", "არა", "რა");

        var entries = await Dictionary();
        entries.Select(e => (e.Word, e.Definition)).Should().BeEquivalentTo(new[] { ("და", "и"), ("არა", "нет"), ("რა", "что") });
        entries.Should().OnlyContain(e => e.Language == Language.Georgian);

        var again = JsonNode.Parse(await (await Post("vocabulary/alphabet-words", new { lessonId = 1 })).Content.ReadAsStringAsync())!;
        again["added"]!.GetValue<int>().Should().Be(0);
        (await Dictionary()).Should().HaveCount(3);
    }

    [Test]
    public async Task A_lesson_that_did_not_count_adds_nothing()
    {
        (await Post("progress/lesson-complete", new { moduleId = "alphabet-progressive", lessonId = 1, correct = 7, total = 10 }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await Post("vocabulary/alphabet-words", new { lessonId = 1 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Post("vocabulary/alphabet-words", new { lessonId = 99 })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Dictionary()).Should().BeEmpty();
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

        lessons.Should().HaveCount(11);
        var total = 0;
        foreach (var lesson in lessons)
        {
            var id = lesson.GetProperty("id").GetInt32();
            var items = TheoryWords(lesson);
            var listed = words.WordsOf(id);
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
