using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Admin;
using Application.Common;
using Application.Feedback;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Persistence;
using Telegram.Bot;
using Telegram.Bot.Requests;
using Telegram.Bot.Types.ReplyMarkups;
using User = Domain.Entities.User;

namespace IntegrationTests.Feedback;

/// <summary>
/// The owner answers people who wrote something — over HTTP, against real Postgres: one
/// conversation per person, the answer goes out by the bot once, what Telegram said is kept, the
/// person's reply lands in the same conversation, and nobody but the owner and the person sees it.
/// </summary>
public class FeedbackReplyTests : TestBase
{
    private const long Owner = 4_300_000_001;
    private static long _nextTelegramId = 8_000_000_000;

    private TraleTestApplication _app = null!;
    private TelegramClientFake _telegram = null!;

    [OneTimeSetUp]
    public void StartSignedApp()
    {
        _app = _testServer.WithSignedLogin(Owner);
        _telegram = (TelegramClientFake)_app.Services.GetRequiredService<ITelegramBotClient>();
    }

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CleanDatabase()
    {
        await InScope(sp => sp.GetRequiredService<TraleDbContext>().Database
            .ExecuteSqlRawAsync("""TRUNCATE "BroadcastCampaigns", "Referrals", "Users" CASCADE"""));
        await AddUser(u => u.TelegramId = Owner);
    }

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private Task<User> AddUser(Action<User>? configure = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "User");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-200);
        configure?.Invoke(user);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    });

    private async Task<(HttpStatusCode Code, JsonElement Body)> Call(long telegramId, HttpMethod method, string path, object? body = null)
    {
        using var client = _app.ClientFor(telegramId);
        using var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }

    private Task<(HttpStatusCode Code, JsonElement Body)> Admin(HttpMethod method, string path, object? body = null) =>
        Call(Owner, method, $"/api/admin/{path}", body);

    private async Task Write(User user, string text) =>
        (await Call(user.TelegramId, HttpMethod.Post, "/api/miniapp/feedback", new { text })).Code.Should().Be(HttpStatusCode.OK);

    private Task<(HttpStatusCode Code, JsonElement Body)> Reply(User to, string? text, string? token = null, Guid? quoteId = null, long by = Owner) =>
        Call(by, HttpMethod.Post, $"/api/admin/feedback/threads/{to.TelegramId}/reply", new { text, token = token ?? Guid.NewGuid().ToString("N"), quoteId });

    private async Task<JsonElement> Thread(User user) => (await Admin(HttpMethod.Get, $"feedback/threads/{user.TelegramId}")).Body;

    private async Task<List<(long TelegramId, string Status, string LastText)>> Threads(bool unanswered = false) =>
        (await Admin(HttpMethod.Get, $"feedback/threads?unanswered={unanswered.ToString().ToLowerInvariant()}")).Body.GetProperty("threads").EnumerateArray()
            .Select(t => (t.GetProperty("telegramId").GetInt64(), t.GetProperty("status").GetString()!, t.GetProperty("lastText").GetString()!)).ToList();

    private async Task<int> Unanswered() => (await Admin(HttpMethod.Get, "feedback?take=1")).Body.GetProperty("unanswered").GetInt32();

    private List<SendMessageRequest> SentTo(User user, int since) =>
        _telegram.Requests.Skip(since).OfType<SendMessageRequest>().Where(m => m.ChatId.Identifier == user.TelegramId).ToList();

    private static List<(bool FromOwner, string Text, string? Delivery)> Items(JsonElement thread) =>
        thread.GetProperty("items").EnumerateArray().Select(i => (
            i.GetProperty("fromOwner").GetBoolean(), i.GetProperty("text").GetString()!,
            i.GetProperty("delivery").ValueKind == JsonValueKind.Null ? null : i.GetProperty("delivery").GetString())).ToList();

    /// <summary>Makes everything recorded for the person so far that many minutes older — to put events in order.</summary>
    private Task<int> Age(User user, int minutes) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<TraleDbContext>().Database;
        await db.ExecuteSqlInterpolatedAsync($"""UPDATE "UserFeedback" SET "CreatedAtUtc" = "CreatedAtUtc" - make_interval(mins => {minutes}) WHERE "UserId" = {user.Id}""");
        return await db.ExecuteSqlInterpolatedAsync($"""UPDATE "FeedbackReplies" SET "CreatedAtUtc" = "CreatedAtUtc" - make_interval(mins => {minutes}) WHERE "UserId" = {user.Id}""");
    });

    [Test]
    public async Task An_answer_reaches_the_person_by_the_bot_with_their_words_quoted_and_is_kept_in_the_conversation()
    {
        var person = await AddUser();
        await Write(person, "Не хватает озвучки\nу слов, которые я добавляю сам");
        await Age(person, 5);
        var mark = _telegram.Requests.Count;

        var (code, body) = await Reply(person, "  Спасибо! Озвучку своих слов сделаю в ноябре.  ");

        code.Should().Be(HttpStatusCode.OK);
        body.GetProperty("delivery").GetString().Should().Be("sent");
        body.GetProperty("repeated").GetBoolean().Should().BeFalse();
        var message = SentTo(person, mark).Single();
        message.Text.Should().Be("Твоё сообщение: «Не хватает озвучки у слов, которые я добавляю сам»\n\nДима, автор TraleBot: Спасибо! Озвучку своих слов сделаю в ноябре.");
        var button = ((InlineKeyboardMarkup)message.ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Text.Should().Be("Ответить");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?screen=feedback&thread=1");
        _telegram.Requests.Skip(mark).OfType<SendMessageRequest>().Should().ContainSingle("the answer goes to this person and nobody else");
        var thread = await Thread(person);
        thread.GetProperty("status").GetString().Should().Be("answered");
        thread.GetProperty("reachable").GetBoolean().Should().BeTrue();
        Items(thread).Should().Equal(
            (false, "Не хватает озвучки\nу слов, которые я добавляю сам", null),
            (true, "Спасибо! Озвучку своих слов сделаю в ноябре.", "sent"));
        thread.GetProperty("items")[0].GetProperty("kind").GetString().Should().Be("message");
    }

    [Test]
    public async Task A_long_text_is_quoted_shortened_and_a_chosen_text_is_quoted_when_asked()
    {
        var person = await AddUser();
        await Write(person, "Первое: " + new string('я', 400));
        await Age(person, 5);
        await Write(person, "Второе, короткое");
        var first = (await Thread(person)).GetProperty("items")[0].GetProperty("id").GetGuid();
        var mark = _telegram.Requests.Count;

        await Reply(person, "Отвечаю на последнее");
        await Reply(person, "Отвечаю на первое", quoteId: first);

        var texts = SentTo(person, mark).Select(m => m.Text).ToList();
        texts[0].Should().StartWith("Твоё сообщение: «Второе, короткое»\n\n");
        var quote = texts[1].Split('\n')[0];
        quote.Should().StartWith("Твоё сообщение: «Первое: яяя").And.EndWith("…»");
        quote.Length.Should().BeLessThanOrEqualTo("Твоё сообщение: «»".Length + FeedbackReplyService.MaxQuoteLength);
    }

    [Test]
    public async Task The_same_answer_tapped_twice_or_many_times_at_once_leaves_once()
    {
        var person = await AddUser();
        await Write(person, "Привет");
        var mark = _telegram.Requests.Count;

        var first = await Reply(person, "Привет!", token: "one-tap");
        var second = await Reply(person, "Привет!", token: "one-tap");
        var race = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Reply(person, "И ещё", token: "many-taps")));

        first.Body.GetProperty("repeated").GetBoolean().Should().BeFalse();
        second.Code.Should().Be(HttpStatusCode.OK);
        second.Body.GetProperty("repeated").GetBoolean().Should().BeTrue();
        race.Should().OnlyContain(r => r.Code == HttpStatusCode.OK);
        race.Count(r => !r.Body.GetProperty("repeated").GetBoolean()).Should().Be(1);
        SentTo(person, mark).Select(m => m.Text!.Split(": ").Last()).Should().BeEquivalentTo("Привет!", "И ещё");
        Items(await Thread(person)).Count(i => i.FromOwner).Should().Be(2);
    }

    [Test]
    public async Task The_persons_reply_lands_in_the_same_conversation_and_the_status_follows_who_spoke_last()
    {
        var person = await AddUser();
        var quiet = await AddUser();
        await Write(person, "Когда будут новые уроки?");
        await Write(quiet, "Спасибо за бота");
        await Age(person, 30);
        await Age(quiet, 60);

        var atFirst = await Threads();
        var unansweredAtFirst = await Unanswered();
        await Reply(person, "В октябре");
        await Age(person, 20);
        var afterAnswer = await Threads();
        var unansweredAfterAnswer = await Unanswered();
        await Write(person, "А про падежи?");
        var afterReplyBack = await Threads();
        var onlyUnanswered = await Threads(unanswered: true);

        atFirst.Select(t => (t.TelegramId, t.Status)).Should().Equal((person.TelegramId, "new"), (quiet.TelegramId, "new"));
        unansweredAtFirst.Should().Be(2);
        afterAnswer.Select(t => (t.TelegramId, t.Status)).Should().Equal((quiet.TelegramId, "new"), (person.TelegramId, "answered"));
        unansweredAfterAnswer.Should().Be(1);
        afterReplyBack.Select(t => (t.TelegramId, t.Status, t.LastText)).Should().Equal(
            (person.TelegramId, "repliedBack", "А про падежи?"), (quiet.TelegramId, "new", "Спасибо за бота"));
        onlyUnanswered.Should().HaveCount(2);
        Items(await Thread(person)).Select(i => (i.FromOwner, i.Text)).Should().Equal(
            (false, "Когда будут новые уроки?"), (true, "В октябре"), (false, "А про падежи?"));
        (await Admin(HttpMethod.Get, "feedback/threads")).Body.GetProperty("unanswered").GetInt32().Should().Be(2);
    }

    [Test]
    public async Task No_answer_needed_takes_the_person_out_of_the_unanswered_without_sending_and_a_new_message_brings_them_back()
    {
        var person = await AddUser();
        await Write(person, "Просто спасибо");
        await Age(person, 10);
        var mark = _telegram.Requests.Count;

        var (code, _) = await Admin(HttpMethod.Post, $"feedback/threads/{person.TelegramId}/dismiss");
        var closed = await Threads();
        var unanswered = await Unanswered();
        var waiting = await Threads(unanswered: true);

        code.Should().Be(HttpStatusCode.OK);
        _telegram.Requests.Skip(mark).Should().BeEmpty("nothing is sent");
        closed.Single().Status.Should().Be("closed");
        unanswered.Should().Be(0);
        waiting.Should().BeEmpty();
        Items(await Thread(person)).Should().OnlyContain(i => !i.FromOwner, "the mark is not a message");
        await Age(person, 10);
        await Write(person, "И ещё вопрос");
        (await Threads()).Single().Status.Should().Be("new");
        (await Unanswered()).Should().Be(1);
        (await Admin(HttpMethod.Post, "feedback/threads/1/dismiss")).Code.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task Words_written_in_a_survey_and_at_the_paywall_are_part_of_the_conversation_too()
    {
        var person = await AddUser();
        (await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "with-words", audience = "accessEnded", sampleSize = (int?)null, dryRun = false,
            survey = new { questions = new object[] { new { text = "Насколько TraleBot тебе нужен?", kind = "choice", options = new[] { "Без него никак", "Могу и без него" }, allowOther = false }, new { text = "Что было неудобно?", kind = "text" } } }
        })).Code.Should().Be(HttpStatusCode.OK);
        await Admin(HttpMethod.Post, "campaigns/with-words/send", new { limit = 100 });
        (await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/surveys/with-words/answer", new { questionId = "q1", option = "Без него никак" })).Code.Should().Be(HttpStatusCode.OK);
        (await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/surveys/with-words/answer", new { questionId = "q2", text = "Долгие уроки" })).Code.Should().Be(HttpStatusCode.OK);
        await Age(person, 10);
        var question = (await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/feedback/paywall-question")).Body.GetProperty("id").GetGuid();
        await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/feedback/paywall-answer", new { id = question, option = "expensive", text = "Год — дорого" });
        var mark = _telegram.Requests.Count;

        var thread = await Thread(person);
        var listedBefore = await Threads();
        await Reply(person, "Понял, подумаю про месяц подешевле");

        thread.GetProperty("items").EnumerateArray().Select(i => (i.GetProperty("kind").GetString(), i.GetProperty("question").GetString(), i.GetProperty("option").GetString(), i.GetProperty("text").GetString()))
            .Should().Equal(("survey", "Что было неудобно?", null, "Долгие уроки"), ("paywall", null, "expensive", "Год — дорого"));
        listedBefore.Single().Should().Be((person.TelegramId, "new", "Год — дорого"));
        SentTo(person, mark).Single().Text.Should().StartWith("Твоё сообщение: «Год — дорого»");
        var listed = (await Admin(HttpMethod.Get, "feedback?kind=paywall")).Body.GetProperty("recent")[0];
        listed.GetProperty("id").GetGuid().Should().Be(thread.GetProperty("items")[1].GetProperty("id").GetGuid(), "an answer in the lists can be replied to by its id");
    }

    // ── Что отвечает Telegram ────────────────────────────────────────────────

    private class ScriptedSender(CampaignSendAttempt answer) : IFeedbackReplySender
    {
        public int Calls;
        public Task<CampaignSendAttempt> SendAsync(long telegramId, string text, CancellationToken ct)
        {
            Interlocked.Increment(ref Calls);
            return Task.FromResult(answer);
        }
    }

    private Task<FeedbackReplyResult> ReplyWith(ScriptedSender sender, User to, string text) => InScope(sp =>
        new FeedbackReplyService(sp.GetRequiredService<ITraleDbContext>(), sender, NullLoggerFactory.Instance)
            .ReplyAsync(to.TelegramId, text, null, Guid.NewGuid().ToString("N"), CancellationToken.None));

    [Test]
    public async Task A_person_who_blocked_the_bot_is_shown_as_not_reached_and_becomes_unreachable()
    {
        var person = await AddUser();
        await Write(person, "Ау");
        await Age(person, 5);

        var result = await ReplyWith(new ScriptedSender(new CampaignSendAttempt(CampaignSendOutcome.Blocked, Error: "Forbidden: bot was blocked by the user")), person, "Привет");

        result.Status.Should().Be(FeedbackReplyStatus.Blocked);
        var thread = await Thread(person);
        Items(thread).Last().Should().Be((true, "Привет", "blocked"));
        thread.GetProperty("reachable").GetBoolean().Should().BeFalse();
        thread.GetProperty("status").GetString().Should().Be("answered", "the owner did what could be done");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == person.Id))).IsActive.Should().BeFalse();
        (await Call(person.TelegramId, HttpMethod.Get, "/api/miniapp/feedback/thread")).Body.GetProperty("items").GetArrayLength()
            .Should().Be(0, "an answer that did not arrive is not shown to the person");
    }

    [TestCase(CampaignSendOutcome.Rejected, "rejected")]
    [TestCase(CampaignSendOutcome.RateLimited, "rejected")]
    [TestCase(CampaignSendOutcome.Unknown, "unknown")]
    public async Task Other_failures_are_kept_with_the_answer_and_the_person_stays_reachable(CampaignSendOutcome outcome, string delivery)
    {
        var person = await AddUser();
        await Write(person, "Ау");
        await Age(person, 5);
        var sender = new ScriptedSender(new CampaignSendAttempt(outcome, Error: "что-то пошло не так"));

        await ReplyWith(sender, person, "Привет");

        sender.Calls.Should().Be(1, "a failed send is not retried by itself");
        Items(await Thread(person)).Last().Should().Be((true, "Привет", delivery));
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == person.Id))).IsActive.Should().BeTrue();
    }

    // ── Кто что видит и может ────────────────────────────────────────────────

    [Test]
    public async Task Only_the_owner_reads_conversations_and_answers()
    {
        var person = await AddUser();
        var stranger = await AddUser();
        await Write(person, "Личное");
        var mark = _telegram.Requests.Count;
        using var anonymous = _app.CreateClient();

        (await Reply(person, "Я не владелец", by: stranger.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);
        (await Reply(person, "Сам себе", by: person.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(stranger.TelegramId, HttpMethod.Get, $"/api/admin/feedback/threads/{person.TelegramId}")).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(stranger.TelegramId, HttpMethod.Get, "/api/admin/feedback/threads")).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(stranger.TelegramId, HttpMethod.Post, $"/api/admin/feedback/threads/{person.TelegramId}/dismiss")).Code.Should().Be(HttpStatusCode.NotFound);
        (await anonymous.PostAsJsonAsync($"/api/admin/feedback/threads/{person.TelegramId}/reply", new { text = "Аноним", token = "t" })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await anonymous.GetAsync("/api/miniapp/feedback/thread")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        _telegram.Requests.Skip(mark).Should().BeEmpty();
        Items(await Thread(person)).Should().ContainSingle();
    }

    [Test]
    public async Task A_person_sees_only_their_own_conversation_and_writes_only_into_it()
    {
        var person = await AddUser();
        var another = await AddUser();
        await Write(person, "Вопрос первого");
        await Write(another, "Вопрос второго");
        await Age(person, 20);
        await Age(another, 20);
        await Reply(person, "Ответ первому");
        await Age(person, 10);
        await Write(person, "Спасибо, понял");

        async Task<List<(bool, string)>> Own(User user) =>
            (await Call(user.TelegramId, HttpMethod.Get, "/api/miniapp/feedback/thread")).Body.GetProperty("items").EnumerateArray()
                .Select(i => (i.GetProperty("fromOwner").GetBoolean(), i.GetProperty("text").GetString()!)).ToList();

        (await Own(person)).Should().Equal((false, "Вопрос первого"), (true, "Ответ первому"), (false, "Спасибо, понял"));
        (await Own(another)).Should().BeEmpty("until the author answers there is no conversation to show");
        Items(await Thread(another)).Select(i => i.Text).Should().Equal("Вопрос второго");
        // There is no way to name another person's conversation: a message always goes into the sender's own.
        (await Call(another.TelegramId, HttpMethod.Post, "/api/miniapp/feedback", new { text = "Лезу в чужое", thread = person.TelegramId, telegramId = person.TelegramId })).Code.Should().Be(HttpStatusCode.OK);
        Items(await Thread(person)).Select(i => i.Text).Should().NotContain("Лезу в чужое");
        Items(await Thread(another)).Select(i => i.Text).Should().Contain("Лезу в чужое");
    }

    [Test]
    public async Task An_answer_must_have_words_fit_a_telegram_message_and_have_something_to_answer()
    {
        var person = await AddUser();
        var silent = await AddUser();
        await Write(person, "Привет");
        var mark = _telegram.Requests.Count;

        (await Reply(person, "   ")).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Reply(person, null)).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Reply(person, new string('я', FeedbackReplyService.MaxReplyLength + 1))).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Call(Owner, HttpMethod.Post, $"/api/admin/feedback/threads/{person.TelegramId}/reply", new { text = "Без токена" })).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Reply(silent, "Тебе никто не писал")).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Reply(person, "На чужой текст", quoteId: Guid.NewGuid())).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Call(Owner, HttpMethod.Post, "/api/admin/feedback/threads/1/reply", new { text = "Никому", token = "x" })).Code.Should().Be(HttpStatusCode.NotFound);
        _telegram.Requests.Skip(mark).Should().BeEmpty();

        (await Reply(person, new string('я', FeedbackReplyService.MaxReplyLength))).Code.Should().Be(HttpStatusCode.OK);
        SentTo(person, mark).Single().Text!.Length.Should().BeLessThan(4096, "Telegram's limit for one message");
    }

    [Test]
    public async Task The_report_query_lists_those_who_wait_for_an_answer()
    {
        var fresh = await AddUser();
        var answered = await AddUser();
        var back = await AddUser();
        var closed = await AddUser();
        foreach (var user in new[] { fresh, answered, back, closed }) await Write(user, $"Первое от {user.TelegramId}");
        foreach (var user in new[] { answered, back, closed }) await Age(user, 30);
        await Reply(answered, "Ответ");
        await Reply(back, "Ответ");
        await Admin(HttpMethod.Post, $"feedback/threads/{closed.TelegramId}/dismiss");
        await Age(back, 10);
        await Write(back, "А ещё вот что");

        var sql = string.Join('\n', System.IO.File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Sql", "feedback-report.sql"))
                .Split('\n').Where(l => !l.TrimStart().StartsWith("--")))
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Last();
        var rows = await InScope(async sp =>
        {
            await using var connection = new NpgsqlConnection(sp.GetRequiredService<TraleDbContext>().Database.GetConnectionString());
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            await using var reader = await command.ExecuteReaderAsync();
            var found = new List<(long, string, long, string)>();
            while (await reader.ReadAsync())
                found.Add((reader.GetInt64(0), reader.GetString(2), reader.GetInt64(3), reader.GetString(4)));
            return found;
        });

        rows.Should().Equal(
            (back.TelegramId, "человек ответил", 2L, "А ещё вот что"),
            (fresh.TelegramId, "новое", 1L, $"Первое от {fresh.TelegramId}"));
    }
}
