using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Translation;
using Application.Verbs;
using FluentAssertions;
using Infrastructure.Telegram;
using Infrastructure.Telegram.BotCommands.TranslateCommands;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot.Requests;

namespace IntegrationTests.Translation;

/// <summary>
/// The bot and a verb that takes the models a long time: the person is told «ищу глагол…» and gets the
/// full answer later — whatever happens to the webhook request meanwhile. Everything that is answered
/// quickly is one message, as before.
/// </summary>
public class SlowTranslationReplyTests : TranslationPipelineTestBase
{
    private static readonly JsonObject Dance =
        Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");

    private static readonly string Lemma = Dance["lemma"]!.GetValue<string>();

    private const string OldAnswer =
        $"Определение: {FakeExternalTranslator.Definition}\nДругие значения: \nТранскрипция: [{FakeExternalTranslator.Definition}]\nПример употребления: ";

    private int _updateId = 7000;
    private long _chat;

    /// <summary>Opened by a test when "the model" may answer.</summary>
    private TaskCompletionSource _modelMayAnswer = null!;

    [SetUp]
    public async Task StartChat()
    {
        _modelMayAnswer = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _chat = Random.Shared.NextInt64(1_000_000, 900_000_000);
        await SeedCatalogWithout(Lemma);
        _startReplies = 0;
        (await Post("/start")).StatusCode.Should().Be(HttpStatusCode.OK);
        _startReplies = Replies().Count;
    }

    [TearDown]
    public void LetTheModelGo() => _modelMayAnswer.TrySetResult();

    private async Task<HttpResponseMessage> Post(string text, int messageId = 1, CancellationToken ct = default)
    {
        var update = Create.TelegramUpdate(++_updateId, _chat, text);
        update.Message!.MessageId = messageId;
        using var client = App.CreateClient();
        return await client.PostAsync("/telegram/test_token", update.ToJsonContent(), ct);
    }

    /// <summary>What the bot wrote to this test's chat after <c>/start</c>, oldest first.</summary>
    private List<SendMessageRequest> Replies() =>
        Telegram.Requests.OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == _chat).Skip(_startReplies).ToList();

    private int _startReplies;

    private async Task<List<SendMessageRequest>> WaitForReplies(int count)
    {
        await Until(() => Replies().Count >= count, $"{count} replies in the chat");
        return Replies();
    }

    private static async Task Until(Func<bool> condition, string what)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (!condition())
        {
            (DateTime.UtcNow < deadline).Should().BeTrue($"expected {what} within 15 seconds");
            await Task.Delay(20);
        }
    }

    /// <summary>
    /// «я танцую» for a verb that is in neither the base nor the source: the strong model writes it (when
    /// the test lets it), the second one approves. The forms are the catalog's own.
    /// </summary>
    private void VerbTheModelsHaveToWrite()
    {
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        string[] main = ["present", "imperfect", "future", "conditional", "aorist", "optative"];
        var written = JsonSerializer.Serialize(new
        {
            verdict = "verb", lemma = Lemma, masdar = Dance["title"]!.GetValue<string>(), russian = "танцевать",
            tenses = main.ToDictionary(t => t, t => Enumerable.Range(0, 6).Select(p => Form(Dance, t, p)).ToArray()),
            russianForms = new
            {
                inf = "танцевать", present = new[] { "танцую", "танцуешь", "танцует", "танцуем", "танцуете", "танцуют" },
                past = new { m = "танцевал", f = "танцевала", pl = "танцевали" }
            },
            matchedTense = "present", matchedPerson = 0
        });
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            await _modelMayAnswer.Task.WaitAsync(ct);
            return new ChatMessage(ChatRole.Assistant, written);
        };
        Models.ReviewerModel.AnswerWith("""{"approve":true,"reasons":["ok"]}""");
    }

    [Test]
    public async Task Quick_answer_is_one_message_as_before()
    {
        Options.SlowReplyNoticeMs = 100;
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");

        (await Post("стол")).StatusCode.Should().Be(HttpStatusCode.OK);

        // The reply is there when the webhook request returns, and nothing follows it.
        Replies().Should().ContainSingle();
        await Task.Delay(400);
        var reply = Replies().Should().ContainSingle().Subject;
        reply.Text.Should().Be(OldAnswer);
        reply.ReplyToMessageId.Should().BeNull();
    }

    [Test]
    public async Task Verb_from_the_base_is_one_message_even_when_the_notice_delay_is_zero()
    {
        Options.SlowReplyNoticeMs = 0;
        Models.Configured = false;
        var write = Catalog().Select(v => v!.AsObject()).Single(v => v["ru"]!.GetValue<string>() == "писать");

        await Post(Form(write, "aorist", 3));

        await Task.Delay(300);
        Replies().Should().ContainSingle().Which.Text.Should().StartWith("Определение: мы писали");
    }

    [Test]
    public async Task Slow_verb_gets_the_notice_at_once_and_the_full_answer_when_it_is_ready()
    {
        Options.SlowReplyNoticeMs = 100;
        VerbTheModelsHaveToWrite();

        // The webhook request returns although the model has not answered: Telegram is not kept waiting.
        (await Post("я танцую", messageId: 41)).StatusCode.Should().Be(HttpStatusCode.OK);

        var notice = Replies().Should().ContainSingle().Subject;
        notice.Text.Should().Be(TranslateCommand.LookingUpVerbText);
        notice.ReplyToMessageId.Should().Be(41);

        _modelMayAnswer.SetResult();

        var answer = (await WaitForReplies(2))[1];
        answer.Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        answer.Text.Should().Contain("Разбор: ").And.Contain("«я танцую»");
        answer.ReplyMarkup.Should().NotBeNull();
        answer.ReplyToMessageId.Should().Be(41, because: "a late answer quotes the word it is for");
        await Task.Delay(200);
        Replies().Should().HaveCount(2);
        (await StoredVerb(Lemma)).Should().NotBeNull();
    }

    [Test]
    public async Task Word_sent_while_a_verb_is_looked_up_is_answered_without_waiting_for_it()
    {
        Options.SlowReplyNoticeMs = 100;
        VerbTheModelsHaveToWrite();
        await Post("я танцую", messageId: 51);
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":false,"russianInfinitive":null}""");

        await Post("стол", messageId: 52);

        var replies = Replies();
        replies.Select(r => r.Text).Should().Equal(TranslateCommand.LookingUpVerbText, OldAnswer);
        replies[1].ReplyToMessageId.Should().BeNull();

        _modelMayAnswer.SetResult();
        var late = (await WaitForReplies(3))[2];
        late.Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        late.ReplyToMessageId.Should().Be(51);
    }

    [Test]
    public async Task Answer_arrives_although_the_webhook_request_was_cancelled_midway()
    {
        // No notice in this test: the request would wait for the answer itself, as long as it takes.
        Options.SlowReplyNoticeMs = 60_000;
        VerbTheModelsHaveToWrite();
        using var telegramGaveUp = new CancellationTokenSource();

        var request = Post("я танцую", ct: telegramGaveUp.Token);
        await Until(() => Models.GeneratorModel.Calls > 0, "the strong model to be asked");
        telegramGaveUp.Cancel();
        await FluentActions.Awaiting(() => request).Should().ThrowAsync<OperationCanceledException>();
        Replies().Should().BeEmpty();

        _modelMayAnswer.SetResult();

        var answer = (await WaitForReplies(1))[0];
        answer.Text.Should().StartWith($"Определение: {Form(Dance, "present", 0)}");
        await Task.Delay(200);
        Replies().Should().ContainSingle(because: "no error message, no second answer");
    }

    [Test]
    public async Task Model_that_hangs_is_cut_off_and_the_old_translation_arrives_after_the_notice()
    {
        Options.SlowReplyNoticeMs = 100;
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        Options.GeneratorTimeoutSeconds = 1;
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        };

        await Post("я танцую");

        var replies = await WaitForReplies(2);
        replies.Select(r => r.Text).Should().Equal(TranslateCommand.LookingUpVerbText, OldAnswer);
        Log.Paths.Last().Should().EndWith(">legacy");
    }

    [Test]
    public async Task Model_that_fails_leaves_the_old_translation_and_no_error_message()
    {
        Options.SlowReplyNoticeMs = 100;
        Lexicon.Verbs.Add(new LexiconVerb(Lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        Models.GeneratorModel.Respond = (_, _) => throw new HttpRequestException("the provider is down");

        await Post("я танцую");

        var replies = await WaitForReplies(1);
        replies.Last().Text.Should().Be(OldAnswer);
        replies.Select(r => r.Text).Should().NotContain(TelegramDialogProcessor.ErrorText);
        Log.Paths.Last().Should().EndWith("generator-failed>legacy");
    }
}

/// <summary>
/// The application stops (a rolling deploy) while a translation is too young to be on record — nobody
/// else knows of it, so the person is told. (One that is on record is done again after the restart:
/// <see cref="DurableTranslationJobTests"/>.) In a fixture of its own: stopping the jobs is final for
/// the application instance.
/// </summary>
public class TranslationShutdownTests : TranslationPipelineTestBase
{
    [Test]
    public async Task Person_is_told_to_send_the_word_again_when_the_bot_stops_before_the_translation_is_on_record()
    {
        const long chat = 770001;
        var dance = Catalog().Select(v => v!.AsObject()).First(v => v["ru"]!.GetValue<string>() == "танцевать");
        var lemma = dance["lemma"]!.GetValue<string>();
        await SeedCatalogWithout(lemma);
        Options.SlowReplyNoticeMs = 60_000;
        Lexicon.Verbs.Add(new LexiconVerb(lemma, null, HasTable: false, ["to dance"], ["танцевать"]));
        Models.ClassifierModel.AnswerWith("""{"notTranslatable":false,"isVerb":true,"russianInfinitive":"танцевать"}""");
        Models.GeneratorModel.Respond = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        };
        using var client = App.CreateClient();
        await client.PostAsync("/telegram/test_token", Create.TelegramUpdate(1, chat).ToJsonContent());
        var before = Telegram.Requests.OfType<SendMessageRequest>().Count(r => r.ChatId.Identifier == chat);
        var request = client.PostAsync("/telegram/test_token", Create.TelegramUpdate(2, chat, "я танцую").ToJsonContent());
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (Models.GeneratorModel.Calls == 0)
        {
            (DateTime.UtcNow < deadline).Should().BeTrue("the strong model should be asked within 15 seconds");
            await Task.Delay(20);
        }

        await App.Services.GetRequiredService<TranslationJobs>().StopAsync(TimeSpan.FromMilliseconds(200), TimeSpan.FromSeconds(10));
        await request;

        Telegram.Requests.OfType<SendMessageRequest>().Where(r => r.ChatId.Identifier == chat).Skip(before).Select(r => r.Text)
            .Should().Equal(TranslateCommand.NotInTimeText);
    }
}
