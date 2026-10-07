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

    private readonly JobStoreWatch _store = new();
    private readonly FailingTranslation _failing;
    private int _updateId = 9000;
    private long _chat;
    private Guid _userId;
    private int _startReplies;

    /// <summary>Opened by a test when "the model" may answer.</summary>
    private TaskCompletionSource _modelMayAnswer = null!;

    public DurableTranslationJobTests() => _failing = new FailingTranslation(_store);

    protected override void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<IPipelineBehavior<TranslateAndCreateVocabularyEntry, CreateVocabularyEntryResult>>(_failing);

        // Every replica keeps its own (real) store; the test watches all of them through one object.
        var store = services.Single(d => d.ServiceType == typeof(ITranslationJobStore));
        services.Remove(store);
        services.AddSingleton<ITranslationJobStore>(sp => new WatchedJobStore(
            (ITranslationJobStore)ActivatorUtilities.CreateInstance(sp, store.ImplementationType!), _store));
    }

    [OneTimeSetUp]
    public void StartOtherReplica() => _other = StartInstance();

    [OneTimeTearDown]
    public async Task StopOtherReplica() => await _other.DisposeAsync();

    [SetUp]
    public async Task StartChat()
    {
        _modelMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _failing.Reset();
        _store.Reset();
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
        _store.Thaw();
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

    /// <summary>
    /// How long a test waits for something that has to happen. Only a failing test waits this long:
    /// nothing a test checks depends on it. It is well above the queue's poll interval (15 s) — the
    /// longest a job can lie in the queue before a worker of some replica notices it.
    /// </summary>
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(60);

    private static async Task Until(Func<Task<bool>> condition, string what)
    {
        var deadline = DateTime.UtcNow + Patience;
        while (!await condition())
        {
            (DateTime.UtcNow < deadline).Should().BeTrue($"expected {what} within {Patience.TotalSeconds} seconds");
            await Task.Delay(20);
        }
    }

    private static async Task<T> Within<T>(Task<T> happens, string what)
    {
        (await Task.WhenAny(happens, Task.Delay(Patience))).Should().BeSameAs(happens, $"expected {what} within {Patience.TotalSeconds} seconds");
        return await happens;
    }

    /// <summary>The holder of the record stopped giving signs of life long enough ago: the record is free to take.</summary>
    private Task TheLeaseRunsOut() => InScope(sp => sp.GetRequiredService<ITraleDbContext>().QueuedTranslations
        .Where(q => q.UserId == _userId && q.FinishedAtUtc == null)
        .ExecuteUpdateAsync(s => s.SetProperty(q => q.LeaseUntilUtc, DateTime.UtcNow.AddSeconds(-1))));

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
        // That a verb is being looked up is noted on the record in passing, not before the notice goes out.
        await Until(async () => (await Record()).VerbLookup, "the record to say a verb is being looked up");
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
        await TheLeaseRunsOut();

        (await WaitForReplies(1))[0].Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
    }

    [Test]
    public async Task Instance_that_comes_back_to_life_after_its_work_was_taken_over_does_not_answer_a_second_time()
    {
        // The instance freezes in the middle of a translation: the model's answer does not reach it and
        // it gives no sign of life, so its lease runs out and the background job does the work again.
        // Then the first run wakes up, with the answer in its hands.
        Options.SlowReplyNoticeMs = 100;
        Options.JobLeaseRenewMs = 50;
        VerbTheModelsHaveToWrite(waitsForTheTest: call => call == 1);

        await Post("я танцую", messageId: 51);
        await Until(() => Models.GeneratorModel.Calls == 1, "the first run to be waiting for the model");
        // Frozen for real: a sign of life arriving after the lease ran out would give the record back
        // to the first run, and nobody would take it over.
        await Within(_store.FreezeFirstRun(), "the first run to stop giving signs of life");
        await TheLeaseRunsOut();

        var replies = await WaitForReplies(2);
        replies[0].Text.Should().Be(TranslateCommand.LookingUpVerbText);
        replies[1].Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        replies[1].ReplyToMessageId.Should().Be(51);
        await Until(async () => (await Record()).State == QueuedTranslationState.Done, "the record to be finished");
        (await Record()).Attempts.Should().Be(2);

        _modelMayAnswer.SetResult();

        (await Within(_store.FirstRunAskedToAnswer, "the first run to come to its answer"))
            .Should().BeFalse(because: "the record is not its own any more");
        await Within(_store.FirstRunOver, "the first run to end");
        Replies().Should().HaveCount(2, because: "the run that lost the record may not answer");
        Models.GeneratorModel.Calls.Should().Be(2);
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
        // The job that stood guard over the translation has ended too: what ends from here on is the repeats.
        await Until(() => Queue() is { Enqueued: 0, Processing: 0 }, "the queue to be empty");
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
        // It breaks once it is on record — every time.
        _failing.Breaks = true;

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
        _failing.Breaks = true;
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

        // The other replica has nothing in memory — it reads the record (that a verb is being looked
        // up is noted on it in passing).
        JsonNode waiting = first;
        await Until(async () => (waiting = await Status(_other, " Я танцую "))["verbLookup"]!.GetValue<bool>(), "the record to say a verb is being looked up");
        waiting["status"]!.GetValue<string>().Should().Be("pending");

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

        // While its lease lasts the record is all there is to tell; then the lease runs out.
        await LeftByADeadInstance("слива", QueuedTranslationSource.MiniApp, leaseLeftMs: 60_000);
        (await Status(_other, "слива"))["status"]!.GetValue<string>().Should().Be("pending");
        await TheLeaseRunsOut();

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
        // The record is closed from inside the background job; the queue counts the job a moment later.
        await Until(() => Queue().Succeeded > 0, "the background job to end");

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
    /// database going away in the middle). A run that started with the request breaks once the job is on
    /// record, the later ones at once.
    /// </summary>
    private sealed class FailingTranslation(JobStoreWatch store)
        : IPipelineBehavior<TranslateAndCreateVocabularyEntry, CreateVocabularyEntryResult>
    {
        private int _calls;

        /// <summary>False: translations work.</summary>
        public bool Breaks { get; set; }

        /// <summary>How many of the next translations break.</summary>
        public int Times { get; set; } = int.MaxValue;

        public int Calls => _calls;

        public void Reset()
        {
            Breaks = false;
            Times = int.MaxValue;
            _calls = 0;
        }

        public async Task<CreateVocabularyEntryResult> Handle(
            TranslateAndCreateVocabularyEntry request, RequestHandlerDelegate<CreateVocabularyEntryResult> next, CancellationToken ct)
        {
            if (Breaks && Interlocked.Increment(ref _calls) <= Times)
            {
                await store.OnRecord.WaitAsync(ct);
                throw new InvalidOperationException("The translation broke (test)");
            }

            return await next();
        }
    }

    /// <summary>
    /// What a test sees of the jobs' durable store, and the one thing it holds back there: the signs of
    /// life of a run that started with a request (start 1) — an instance that froze gives none. One
    /// for all replicas; a test has one such run at a time.
    /// </summary>
    private sealed class JobStoreWatch
    {
        private readonly object _sync = new();
        private bool _frozen;
        private int _signsOnTheirWay;
        private TaskCompletionSource _landed = Signal();
        private TaskCompletionSource _held = Signal();
        private TaskCompletionSource _thaw = Signal();
        private TaskCompletionSource _onRecord = Signal();
        private TaskCompletionSource<bool> _firstRunOver = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private TaskCompletionSource<bool> _firstRunAskedToAnswer = new(TaskCreationOptions.RunContinuationsAsynchronously);

        private static TaskCompletionSource Signal() => new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>A job has been put on record.</summary>
        public Task OnRecord
        {
            get
            {
                lock (_sync)
                {
                    return _onRecord.Task;
                }
            }
        }

        /// <summary>The first run came to its answer and asked whether it may send it: the store's reply.</summary>
        public Task<bool> FirstRunAskedToAnswer
        {
            get
            {
                lock (_sync)
                {
                    return _firstRunAskedToAnswer.Task;
                }
            }
        }

        /// <summary>The frozen first run has ended: whatever it was going to send, it has sent.</summary>
        public Task<bool> FirstRunOver
        {
            get
            {
                lock (_sync)
                {
                    return _firstRunOver.Task;
                }
            }
        }

        public void Reset()
        {
            lock (_sync)
            {
                _thaw.TrySetResult();
                _frozen = false;
                _signsOnTheirWay = 0;
                _landed = Signal();
                _held = Signal();
                _thaw = Signal();
                _onRecord = Signal();
                _firstRunOver = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                _firstRunAskedToAnswer = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            }
        }

        /// <summary>
        /// From here on the first run gives no sign of life. Completes when the sign that was on its way
        /// has landed and the next one is being held: nothing renews the lease after this.
        /// </summary>
        public async Task<bool> FreezeFirstRun()
        {
            Task landed, held;
            lock (_sync)
            {
                _frozen = true;
                if (_signsOnTheirWay == 0)
                {
                    _landed.TrySetResult();
                }

                landed = _landed.Task;
                held = _held.Task;
            }

            await landed;
            await held;
            return true;
        }

        public void Thaw()
        {
            lock (_sync)
            {
                _frozen = false;
                _thaw.TrySetResult();
            }
        }

        public void PutOnRecord()
        {
            lock (_sync)
            {
                _onRecord.TrySetResult();
            }
        }

        public void AskedToAnswer(TranslationLease lease, bool allowed)
        {
            if (lease.Attempt == 1)
            {
                lock (_sync)
                {
                    _firstRunAskedToAnswer.TrySetResult(allowed);
                }
            }
        }

        public async Task<bool> SignOfLife(TranslationLease lease, Func<Task<bool>> renew, CancellationToken ct)
        {
            if (lease.Attempt != 1)
            {
                return await renew();
            }

            Task? thaw = null;
            TaskCompletionSource landed;
            TaskCompletionSource<bool> over;
            lock (_sync)
            {
                landed = _landed;
                over = _firstRunOver;
                if (_frozen)
                {
                    thaw = _thaw.Task;
                    _held.TrySetResult();
                }
                else
                {
                    _signsOnTheirWay++;
                }
            }

            if (thaw != null)
            {
                try
                {
                    await thaw.WaitAsync(ct);
                }
                catch (OperationCanceledException)
                {
                    // A run stops its signs of life when it is over.
                    over.TrySetResult(true);
                    throw;
                }

                return await renew();
            }

            try
            {
                return await renew();
            }
            finally
            {
                lock (_sync)
                {
                    if (landed == _landed && --_signsOnTheirWay == 0 && _frozen)
                    {
                        landed.TrySetResult();
                    }
                }
            }
        }
    }

    /// <summary>A replica's own store, reporting to <see cref="JobStoreWatch"/>.</summary>
    private sealed class WatchedJobStore(ITranslationJobStore inner, JobStoreWatch watch) : ITranslationJobStore
    {
        public async Task CreateAsync(QueuedTranslation queued, CancellationToken ct)
        {
            await inner.CreateAsync(queued, ct);
            watch.PutOnRecord();
        }

        public Task<bool> RenewAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct) =>
            watch.SignOfLife(lease, () => inner.RenewAsync(lease, duration, ct), ct);

        public async Task<bool> BeginAnswerAsync(TranslationLease lease, TimeSpan duration, CancellationToken ct)
        {
            var allowed = await inner.BeginAnswerAsync(lease, duration, ct);
            watch.AskedToAnswer(lease, allowed);
            return allowed;
        }

        public Task<QueuedTranslation?> FindAsync(Guid id, CancellationToken ct) => inner.FindAsync(id, ct);

        public Task<QueuedTranslation?> FindLatestAsync(Guid userId, string wordKey, CancellationToken ct) =>
            inner.FindLatestAsync(userId, wordKey, ct);

        public Task<TranslationLease?> TryClaimAsync(Guid id, Guid owner, TimeSpan lease, CancellationToken ct) =>
            inner.TryClaimAsync(id, owner, lease, ct);

        public Task ReleaseAsync(TranslationLease lease, bool uncount, CancellationToken ct) => inner.ReleaseAsync(lease, uncount, ct);

        public Task<bool> FinishAsync(
            TranslationLease lease, QueuedTranslationState state, string outcome, Guid? vocabularyEntryId, CancellationToken ct) =>
            inner.FinishAsync(lease, state, outcome, vocabularyEntryId, ct);

        public Task MarkVerbLookupAsync(Guid id, CancellationToken ct) => inner.MarkVerbLookupAsync(id, ct);

        public Task MarkNoticeSentAsync(Guid id, CancellationToken ct) => inner.MarkNoticeSentAsync(id, ct);
    }
}
