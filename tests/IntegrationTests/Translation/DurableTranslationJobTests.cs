using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Common;
using Application.Translation;
using Application.Verbs;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.BackgroundJobs;
using Infrastructure.Telegram.BotCommands.TranslateCommands;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using IntegrationTests.Fakes;
using MediatR;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot;
using Telegram.Bot.Requests;

namespace IntegrationTests.Translation;

/// <summary>
/// A translation that outlives its request is on record in the database and guarded by a job in the
/// durable queue: whatever happens to the instance working on it, the person gets the answer — once.
/// Real Postgres, the real queue (Hangfire with its workers), two instances of the application where
/// a test needs "the other replica". What answers quickly never touches any of it.
/// </summary>
public class DurableTranslationJobTests : TranslationPipelineTestBase
{
    private static readonly JsonObject Dance =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");

    private static readonly string Lemma = Dance["lemma"]!.GetValue<string>();

    private const string OldAnswer =
        $"Определение: {FakeExternalTranslator.Definition}\nДругие значения: \nТранскрипция: [{FakeExternalTranslator.Definition}]\nПример употребления: ";

    /// <summary>The second replica: same database, same fakes, its own memory, workers and Telegram client.</summary>
    private WebApplicationFactory<Program> _other = null!;

    private readonly FailingTranslation _failing = new();
    private int _updateId = 9000;
    private long _chat;
    private Guid _userId;
    private int _startReplies;

    /// <summary>Opened by a test when "the model" may answer.</summary>
    private TaskCompletionSource _modelMayAnswer = null!;

    protected override void ConfigureServices(IServiceCollection services) =>
        services.AddSingleton<IPipelineBehavior<TranslateAndCreateVocabularyEntry, CreateVocabularyEntryResult>>(_failing);

    [OneTimeSetUp]
    public void StartOtherReplica() => _other = StartInstance();

    [OneTimeTearDown]
    public async Task StopOtherReplica() => await _other.DisposeAsync();

    [SetUp]
    public async Task StartChat()
    {
        _modelMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _failing.Reset();
        _chat = Random.Shared.NextInt64(1_000_000, 900_000_000);
        await SeedCatalogWithout(Lemma);
        _startReplies = 0;
        (await Post("/start")).StatusCode.Should().Be(HttpStatusCode.OK);
        _startReplies = Replies().Count;
        _userId = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.Where(u => u.TelegramId == _chat).Select(u => u.Id).SingleAsync());

        // The second replica runs with the same settings as the first.
        var other = OptionsOf(_other);
        other.JobLeaseMs = Options.JobLeaseMs;
        other.JobLeaseRenewMs = Options.JobLeaseRenewMs;
        other.JobPollMs = Options.JobPollMs;
        other.JobRetryDelayMs = Options.JobRetryDelayMs;
        other.JobMaxAttempts = Options.JobMaxAttempts;
    }

    [TearDown]
    public async Task LetTheModelGo()
    {
        _modelMayAnswer.TrySetResult();
        // No test leaves work behind for the next one: every record of this chat's user is brought to its end.
        await Until(async () => !(await Records()).Any(r => !r.IsFinished), "the jobs of the test to finish");
    }

    private static Application.Translation.Pipeline.TranslationAgentOptions OptionsOf(WebApplicationFactory<Program> app) =>
        app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<Application.Translation.Pipeline.TranslationAgentOptions>>().Value;

    private async Task<HttpResponseMessage> Post(string text, int messageId = 1)
    {
        var update = Create.TelegramUpdate(++_updateId, _chat, text);
        update.Message!.MessageId = messageId;
        using var client = App.CreateClient();
        return await client.PostAsync("/telegram/test_token", update.ToJsonContent());
    }

    /// <summary>What the bot wrote to this test's chat after <c>/start</c> — from either replica.</summary>
    private List<SendMessageRequest> Replies() =>
        Telegram.Requests.OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == _chat).Skip(_startReplies)
            .Concat(((TelegramClientFake)_other.Services.GetRequiredService<ITelegramBotClient>()).Requests
                .OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == _chat))
            .ToList();

    private async Task<List<SendMessageRequest>> WaitForReplies(int count)
    {
        await Until(() => Replies().Count >= count, $"{count} replies in the chat");
        return Replies();
    }

    private static Task Until(Func<bool> condition, string what) => Until(() => Task.FromResult(condition()), what);

    private static async Task Until(Func<Task<bool>> condition, string what)
    {
        var deadline = DateTime.UtcNow.AddSeconds(20);
        while (!await condition())
        {
            (DateTime.UtcNow < deadline).Should().BeTrue($"expected {what} within 20 seconds");
            await Task.Delay(20);
        }
    }

    private Task<List<QueuedTranslation>> Records() => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().QueuedTranslations.AsNoTracking()
            .Where(q => q.UserId == _userId).OrderBy(q => q.CreatedAtUtc).ToListAsync());

    private async Task<QueuedTranslation> Record() => (await Records()).Should().ContainSingle().Subject;

    private JobQueueMonitor.Counts Queue() => App.Services.GetRequiredService<JobQueueMonitor>().Read();

    /// <summary>Every background job the queue has seen, in whatever state it is now.</summary>
    private long JobsEver()
    {
        var queue = Queue();
        return queue.Enqueued + queue.Scheduled + queue.Processing + queue.Succeeded + queue.Failed;
    }

    /// <summary>
    /// What an instance that was killed in the middle of a translation leaves behind: the record with
    /// its lease, and the job in the queue. Nothing in any instance's memory.
    /// </summary>
    private async Task<Guid> LeftByADeadInstance(
        string word, QueuedTranslationSource source = QueuedTranslationSource.Bot, int attempts = 1, int leaseLeftMs = 300,
        bool noticeSent = true, int messageId = 77, TimeSpan? askedAgo = null)
    {
        var id = Guid.NewGuid();
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.QueuedTranslations.Add(new QueuedTranslation
            {
                Id = id, Source = source, UserId = _userId, Word = word, WordKey = word.Trim().ToLowerInvariant(),
                ChatId = source == QueuedTranslationSource.Bot ? _chat : null,
                MessageId = source == QueuedTranslationSource.Bot ? messageId : null,
                State = QueuedTranslationState.Pending, VerbLookup = true, NoticeSent = noticeSent, Attempts = attempts,
                LeaseOwner = Guid.NewGuid(), LeaseUntilUtc = DateTime.UtcNow.AddMilliseconds(leaseLeftMs),
                CreatedAtUtc = DateTime.UtcNow - (askedAgo ?? TimeSpan.FromSeconds(30))
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        App.Services.GetRequiredService<ITranslationJobQueue>().Enqueue(id);
        return id;
    }

    private string Written() => JsonSerializer.Serialize(new
    {
        verdict = "verb", lemma = Lemma, masdar = Dance["title"]!.GetValue<string>(), russian = "танцевать",
        tenses = new[] { "present", "imperfect", "future", "conditional", "aorist", "optative" }
            .ToDictionary(t => t, t => Enumerable.Range(0, 6).Select(p => Form(Dance, t, p)).ToArray()),
        russianForms = new
        {
            inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
            past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
        },
        matchedTense = "present", matchedPerson = 0
    });

    /// <summary>«я танцую» for a verb that is in neither the base nor the source: the strong model writes it when the test lets it.</summary>
    private void VerbTheModelsHaveToWrite(Func<int, bool>? waitsForTheTest = null)
    {
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        var written = Written();
        var calls = 0;
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            if (waitsForTheTest?.Invoke(Interlocked.Increment(ref calls)) ?? true)
            {
                await _modelMayAnswer.Task.WaitAsync(ct);
            }

            return new ChatMessage(ChatRole.Assistant, written);
        };
        Models.ReviewerModel.AnswerWith("""{"approve":true,"reasons":["ok"]}""");
    }

    // ── What answers quickly ─────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Quick_answer_is_one_message_at_once_and_goes_nowhere_near_the_queue()
    {
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");
        var queuedBefore = JobsEver();

        (await Post("стол")).StatusCode.Should().Be(HttpStatusCode.OK);

        // The reply is there when the webhook request returns — nothing waited for a worker.
        Replies().Should().ContainSingle().Which.Text.Should().Be(OldAnswer);
        (await Records()).Should().BeEmpty(because: "a quick answer is not put on record");
        await Task.Delay(300);
        JobsEver().Should().Be(queuedBefore, because: "no background job was queued for it");
        Replies().Should().ContainSingle();
    }

    // ── A slow verb, nothing going wrong ─────────────────────────────────────────────────────────

    [Test]
    public async Task Slow_verb_is_put_on_record_with_the_notice_and_finished_with_the_answer()
    {
        Options.SlowReplyNoticeMs = 100;
        VerbTheModelsHaveToWrite();
        var succeededBefore = Queue().Succeeded;

        (await Post("я танцую", messageId: 41)).StatusCode.Should().Be(HttpStatusCode.OK);

        Replies().Should().ContainSingle().Which.Text.Should().Be(TranslateCommand.LookingUpVerbText);
        var waiting = await Record();
        waiting.State.Should().Be(QueuedTranslationState.Pending);
        waiting.Should().BeEquivalentTo(new
        {
            Source = QueuedTranslationSource.Bot, Word = "я танцую", ChatId = _chat, MessageId = 41,
            NoticeSent = true, VerbLookup = true, Attempts = 1
        });
        waiting.LeaseUntilUtc.Should().BeAfter(DateTime.UtcNow, because: "the instance translating it holds the record");

        _modelMayAnswer.SetResult();

        var answer = (await WaitForReplies(2))[1];
        answer.Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        answer.ReplyToMessageId.Should().Be(41);
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        var done = await Record();
        done.Outcome.Should().Be(QueuedTranslationOutcome.Success);
        done.VocabularyEntryId.Should().NotBeNull();
        done.Attempts.Should().Be(1);

        // The background job that stood guard finds the work done and ends; it sends nothing.
        await Until(() => Queue().Succeeded > succeededBefore, "the background job to finish");
        Replies().Should().HaveCount(2);
        Models.GeneratorModel.Calls.Should().Be(1);
    }

    // ── The instance doing the work dies ─────────────────────────────────────────────────────────

    [Test]
    public async Task Translation_of_an_instance_that_died_is_done_again_and_answered_exactly_once()
    {
        VerbTheModelsHaveToWrite(waitsForTheTest: _ => false);

        // The person already has «ищу глагол…» from the instance that is no more.
        var id = await LeftByADeadInstance("я танцую", messageId: 77);

        var answer = (await WaitForReplies(1))[0];
        answer.Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        answer.Text.Should().Contain("Разбор: ").And.Contain("«я танцую»");
        answer.ReplyToMessageId.Should().Be(77, because: "a late answer quotes the word it is for");
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        (await Record()).Should().BeEquivalentTo(new { Id = id, Attempts = 2, Outcome = QueuedTranslationOutcome.Success });

        await Task.Delay(300);
        Replies().Should().ContainSingle(because: "no second notice, no second answer");
        Models.GeneratorModel.Calls.Should().Be(1);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VocabularyEntries.CountAsync(e => e.UserId == _userId))).Should().Be(1);
    }

    [Test]
    public async Task Translation_found_in_the_queue_a_day_later_is_closed_without_a_word()
    {
        VerbTheModelsHaveToWrite(waitsForTheTest: _ => false);

        await LeftByADeadInstance("я танцую", leaseLeftMs: 0, askedAgo: TimeSpan.FromHours(25));

        await Until(async () => (await Record()).State == QueuedTranslationState.Failed, "the record to be closed");
        await Task.Delay(300);
        Replies().Should().BeEmpty(because: "an answer a day late would come out of nowhere");
        Models.ModelCalls.Should().Be(0);
    }

    [Test]
    public async Task Nobody_touches_a_translation_while_the_instance_doing_it_is_alive()
    {
        VerbTheModelsHaveToWrite(waitsForTheTest: _ => false);

        // The lease is far from running out: its holder is at work.
        await LeftByADeadInstance("я танцую", leaseLeftMs: 60_000);
        await Task.Delay(700);

        Replies().Should().BeEmpty();
        Models.ModelCalls.Should().Be(0);
        (await Record()).Attempts.Should().Be(1);

        // … and now it is gone.
        await InScope(sp => sp.GetRequiredService<ITraleDbContext>().QueuedTranslations
            .Where(q => q.UserId == _userId).ExecuteUpdateAsync(s => s.SetProperty(q => q.LeaseUntilUtc, DateTime.UtcNow)));

        (await WaitForReplies(1))[0].Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
    }

    [Test]
    public async Task Instance_that_comes_back_to_life_after_its_work_was_taken_over_does_not_answer_a_second_time()
    {
        // The first run hangs on the model and its lease runs out (as if the instance froze): the
        // background job does the work again. Then the first run wakes up.
        Options.SlowReplyNoticeMs = 100;
        VerbTheModelsHaveToWrite(waitsForTheTest: call => call == 1);

        await Post("я танцую", messageId: 51);
        await Until(() => Models.GeneratorModel.Calls == 1, "the first run to be waiting for the model");
        await InScope(sp => sp.GetRequiredService<ITraleDbContext>().QueuedTranslations
            .Where(q => q.UserId == _userId).ExecuteUpdateAsync(s => s.SetProperty(q => q.LeaseUntilUtc, DateTime.UtcNow.AddSeconds(-1))));

        var replies = await WaitForReplies(2);
        replies[0].Text.Should().Be(TranslateCommand.LookingUpVerbText);
        replies[1].Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        replies[1].ReplyToMessageId.Should().Be(51);
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        (await Record()).Attempts.Should().Be(2);

        _modelMayAnswer.SetResult();
        await Until(() => Models.ReviewerModel.Calls >= 2 || Models.GeneratorModel.Calls >= 2, "the first run to go on");
        await Task.Delay(500);

        Replies().Should().HaveCount(2, because: "the run that lost the record may not answer");
    }

    // ── A job delivered again ────────────────────────────────────────────────────────────────────

    [Test]
    public async Task Job_delivered_again_for_an_answered_translation_sends_nothing()
    {
        Options.SlowReplyNoticeMs = 100;
        VerbTheModelsHaveToWrite();
        await Post("я танцую");
        _modelMayAnswer.SetResult();
        await WaitForReplies(2);
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        var id = (await Record()).Id;
        var modelCalls = Models.ModelCalls;
        var succeeded = Queue().Succeeded;

        // The queue is at-least-once: the same job comes again — to this replica and to the other.
        App.Services.GetRequiredService<ITranslationJobQueue>().Enqueue(id);
        _other.Services.GetRequiredService<ITranslationJobQueue>().Enqueue(id);
        await _other.Services.GetRequiredService<TranslationJobs>().ResumeAsync(id, CancellationToken.None);
        await Until(() => Queue().Succeeded >= succeeded + 2, "both repeated jobs to end");

        Replies().Should().HaveCount(2);
        Models.ModelCalls.Should().Be(modelCalls);
        (await Record()).Attempts.Should().Be(1);
    }

    // ── Runs that keep failing ───────────────────────────────────────────────────────────────────

    [Test]
    public async Task Translation_that_fails_every_time_is_given_up_after_the_last_attempt_and_the_person_is_told_once()
    {
        Options.SlowReplyNoticeMs = 100;
        Options.JobMaxAttempts = 3;
        OptionsOf(_other).JobMaxAttempts = 3;
        // Long enough to be put on record, then it breaks — every time.
        _failing.After = TimeSpan.FromMilliseconds(400);

        await Post("стол");

        var reply = (await WaitForReplies(1))[0];
        reply.Text.Should().Be(TranslateCommand.NotInTimeText);
        await Until(async () => (await Record()).State == QueuedTranslationState.Failed, "the record to be given up");
        _failing.Calls.Should().Be(3);

        await Task.Delay(800);
        _failing.Calls.Should().Be(3, because: "nothing is tried after the last attempt");
        Replies().Should().ContainSingle();
        (await Record()).Outcome.Should().Be(QueuedTranslationOutcome.Failure);
    }

    [Test]
    public async Task Translation_that_fails_once_is_tried_again_and_answered()
    {
        Options.SlowReplyNoticeMs = 100;
        _failing.After = TimeSpan.FromMilliseconds(400);
        _failing.Times = 1;
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");

        await Post("стол");

        var reply = (await WaitForReplies(1))[0];
        reply.Text.Should().Be(OldAnswer);
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        (await Record()).Attempts.Should().Be(2);
        await Task.Delay(300);
        Replies().Should().ContainSingle(because: "no error message for the failed run, one answer");
    }

    // ── The application stops (a rolling deploy) ─────────────────────────────────────────────────

    [Test]
    public async Task Restart_in_the_middle_leaves_the_record_free_and_does_not_use_up_an_attempt()
    {
        // An instance of its own: stopping its jobs is final for an instance.
        var stopping = StartInstance();
        try
        {
            // A starting instance loads the whole catalog; this test's verb must not be in the base.
            await SeedCatalogWithout(Lemma);
            var o = OptionsOf(stopping);
            o.SlowReplyNoticeMs = 100;
            o.JobPollMs = 50;
            VerbTheModelsHaveToWrite(waitsForTheTest: call => call == 1);
            var update = Create.TelegramUpdate(++_updateId, _chat, "я танцую");
            update.Message!.MessageId = 61;
            using var client = stopping.CreateClient();
            await client.PostAsync("/telegram/test_token", update.ToJsonContent());
            await Until(() => Models.GeneratorModel.Calls == 1, "the first run to be waiting for the model");
            await stopping.Services.GetRequiredService<TranslationJobs>().StopAsync(TimeSpan.FromMilliseconds(200), TimeSpan.FromSeconds(10));

            // Whichever instance has the background job does the work again; the person is not told to resend.
            List<string> All() => ((TelegramClientFake)stopping.Services.GetRequiredService<ITelegramBotClient>()).Requests
                .OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == _chat).Select(r => r.Text)
                .Concat(Replies().Select(r => r.Text)).ToList();
            await Until(() => All().Count >= 2, "the answer after the restart");
            await Task.Delay(300);
            var all = All();
            all.Should().NotContain(TranslateCommand.NotInTimeText);
            all.Count(t => t == TranslateCommand.LookingUpVerbText).Should().Be(1);
            all.Count(t => t.StartsWith($"Определение: {Form(Dance, "present", 0)}")).Should().Be(1);
            all.Should().HaveCount(2);
            await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
            (await Record()).Attempts.Should().Be(1, because: "a run stopped by a restart does not count");
        }
        finally
        {
            _modelMayAnswer.TrySetResult();
            await stopping.DisposeAsync();
        }
    }

    // ── The mini-app: the status from a replica that does not run the job ────────────────────────

    /// <summary>initData signed the way Telegram signs it, with the test host's bot token.</summary>
    private static string InitData(long telegramId)
    {
        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["auth_date"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
            ["query_id"] = "test",
            ["user"] = JsonSerializer.Serialize(new { id = telegramId, first_name = "Learner" })
        };
        var check = string.Join("\n", fields.Select(f => $"{f.Key}={f.Value}"));
        var secret = HMACSHA256.HashData(Encoding.UTF8.GetBytes("WebAppData"), Encoding.UTF8.GetBytes(BotToken));
        fields["hash"] = Convert.ToHexString(HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(check))).ToLowerInvariant();
        return string.Join("&", fields.Select(f => $"{f.Key}={Uri.EscapeDataString(f.Value)}"));
    }

    private async Task<(HttpStatusCode Code, JsonNode? Body)> Call(
        WebApplicationFactory<Program> replica, HttpMethod method, string path, object? body = null, long? as_ = null)
    {
        using var client = replica.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-Telegram-Init-Data", InitData(as_ ?? _chat));
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }

        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, string.IsNullOrEmpty(text) ? null : JsonNode.Parse(text));
    }

    private async Task<JsonNode> Status(WebApplicationFactory<Program> replica, string word) =>
        (await Call(replica, HttpMethod.Post, "/api/miniapp/translate/status", new { word })).Body!;

    [Test]
    public async Task Status_asked_of_another_replica_follows_the_job_to_its_answer()
    {
        Options.MiniAppTranslateWaitMs = 100;
        VerbTheModelsHaveToWrite();

        var first = (await Call(App, HttpMethod.Post, "/api/miniapp/translate", new { word = "я танцую" })).Body!;
        first["status"]!.GetValue<string>().Should().Be("pending");

        // The other replica has nothing in memory — it reads the record.
        var waiting = await Status(_other, " Я танцую ");
        waiting["status"]!.GetValue<string>().Should().Be("pending");
        waiting["verbLookup"]!.GetValue<bool>().Should().BeTrue();

        // The same word sent to the other replica joins the work instead of starting it again.
        var joined = (await Call(_other, HttpMethod.Post, "/api/miniapp/translate", new { word = "я танцую" })).Body!;
        joined["status"]!.GetValue<string>().Should().Be("pending");
        joined["verbLookup"]!.GetValue<bool>().Should().BeTrue();

        _modelMayAnswer.SetResult();

        JsonNode answer = waiting;
        await Until(async () => (answer = await Status(_other, "я танцую"))["status"]!.GetValue<string>() != "pending", "the other replica to see the answer");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(Form(Dance, "present", 0));
        answer["verb"]!["verbId"]!.GetValue<string>().Should().Be(Lemma);
        answer["vocabularyEntryId"]!.GetValue<string>().Should().Be((await Record()).VocabularyEntryId.ToString());

        // The replica that ran it says the same.
        var own = await Status(App, "я танцую");
        own["status"]!.GetValue<string>().Should().Be("success");
        own["vocabularyEntryId"]!.GetValue<string>().Should().Be(answer["vocabularyEntryId"]!.GetValue<string>());
        Models.GeneratorModel.Calls.Should().Be(1);
        Replies().Should().BeEmpty(because: "the mini-app's translation is not a chat message");
    }

    [Test]
    public async Task Status_asked_of_another_replica_tells_a_failure_and_a_text_that_is_not_a_word()
    {
        // No translator has an answer; slow enough to be put on record.
        Options.MiniAppTranslateWaitMs = 100;
        Models.Configured = false;
        External.Fails = true;
        var siteMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        External.Before = () => siteMayAnswer.Task;
        (await Call(App, HttpMethod.Post, "/api/miniapp/translate", new { word = "стол" })).Body!["status"]!.GetValue<string>().Should().Be("pending");
        (await Status(_other, "стол"))["verbLookup"]!.GetValue<bool>().Should().BeFalse(because: "a slow dictionary site is not a verb being looked up");

        siteMayAnswer.SetResult();

        JsonNode failure = null!;
        await Until(async () => (failure = await Status(_other, "стол"))["status"]!.GetValue<string>() != "pending", "the other replica to see the end");
        failure["status"]!.GetValue<string>().Should().Be("failure");

        // Gibberish the classifier rejects, slow in the same way.
        Models.Configured = true;
        Models.ClassifierModel.Respond = async (_, ct) =>
        {
            await _modelMayAnswer.Task.WaitAsync(ct);
            return new ChatMessage(ChatRole.Assistant, """{"notTranslatable":true,"isVerb":false,"russianInfinitive":null}""");
        };
        Options.ClassifierTimeoutSeconds = 10;
        try
        {
            (await Call(App, HttpMethod.Post, "/api/miniapp/translate", new { word = "ываыва" })).Body!["status"]!.GetValue<string>().Should().Be("pending");
            _modelMayAnswer.SetResult();

            JsonNode notAWord = null!;
            await Until(async () => (notAWord = await Status(_other, "ываыва"))["status"]!.GetValue<string>() != "pending", "the other replica to see the end");
            notAWord["status"]!.GetValue<string>().Should().Be("not_a_word");
        }
        finally
        {
            Options.ClassifierTimeoutSeconds = 1;
        }

        // A job that was given up.
        var givenUp = await LeftByADeadInstance("кот", QueuedTranslationSource.MiniApp, attempts: Options.JobMaxAttempts, leaseLeftMs: 0);
        await Until(async () => (await Records()).Single(r => r.Id == givenUp).State == QueuedTranslationState.Failed, "the job to be given up");
        (await Status(_other, "кот"))["status"]!.GetValue<string>().Should().Be("failure");
        (await Status(App, "кот"))["status"]!.GetValue<string>().Should().Be("failure");
    }

    [Test]
    public async Task Mini_app_translation_of_an_instance_that_died_is_done_again_and_its_status_is_the_answer()
    {
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");

        await LeftByADeadInstance("слива", QueuedTranslationSource.MiniApp);
        (await Status(_other, "слива"))["status"]!.GetValue<string>().Should().Be("pending");

        JsonNode answer = null!;
        await Until(async () => (answer = await Status(_other, "слива"))["status"]!.GetValue<string>() != "pending", "the translation to be done again");
        answer["status"]!.GetValue<string>().Should().Be("success");
        answer["definition"]!.GetValue<string>().Should().Be(FakeExternalTranslator.Definition);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().VocabularyEntries.CountAsync(e => e.UserId == _userId))).Should().Be(1);
        Replies().Should().BeEmpty();
    }

    // ── The owner's look at the queue ────────────────────────────────────────────────────────────

    [Test]
    public async Task Queue_counts_are_for_the_owner_only()
    {
        const long owner = 309149393;
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            if (!await db.Users.AnyAsync(u => u.TelegramId == owner))
            {
                db.Users.Add(Create.User(owner, "Owner"));
                await db.SaveChangesAsync(CancellationToken.None);
            }

            return 0;
        });
        await LeftByADeadInstance("кот", QueuedTranslationSource.MiniApp, attempts: Options.JobMaxAttempts, leaseLeftMs: 0);
        await Until(async () => (await Record()).State == QueuedTranslationState.Failed, "the job to be given up");

        using var anonymous = App.CreateClient();
        (await anonymous.GetAsync("/api/admin/jobs")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Call(App, HttpMethod.Get, "/api/admin/jobs")).Code.Should().Be(HttpStatusCode.NotFound, because: "a learner is not the owner");

        var (code, body) = await Call(App, HttpMethod.Get, "/api/admin/jobs", as_: owner);

        code.Should().Be(HttpStatusCode.OK);
        body!["queue"]!["servers"]!.GetValue<long>().Should().BeGreaterThanOrEqualTo(2, because: "both replicas serve the queue");
        body["queue"]!["succeeded"]!.GetValue<long>().Should().BeGreaterThan(0);
        body["queue"]!["failed"]!.GetValue<long>().Should().Be(0);
        body["translationsLast24h"]!["failed"]!.GetValue<int>().Should().BeGreaterThan(0);
    }

    /// <summary>
    /// Makes the translation itself break — something no translator's own fallback catches (in life: the
    /// database going away in the middle).
    /// </summary>
    private sealed class FailingTranslation : IPipelineBehavior<TranslateAndCreateVocabularyEntry, CreateVocabularyEntryResult>
    {
        private int _calls;

        /// <summary>Null: translations work.</summary>
        public TimeSpan? After { get; set; }

        /// <summary>How many of the next translations break.</summary>
        public int Times { get; set; } = int.MaxValue;

        public int Calls => _calls;

        public void Reset()
        {
            After = null;
            Times = int.MaxValue;
            _calls = 0;
        }

        public async Task<CreateVocabularyEntryResult> Handle(
            TranslateAndCreateVocabularyEntry request, RequestHandlerDelegate<CreateVocabularyEntryResult> next, CancellationToken ct)
        {
            if (After is { } delay && Interlocked.Increment(ref _calls) <= Times)
            {
                await Task.Delay(delay, ct);
                throw new InvalidOperationException("The translation broke (test)");
            }

            return await next();
        }
    }
}
