using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Admin;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Persistence;
using Telegram.Bot;
using Telegram.Bot.Requests;
using Telegram.Bot.Types.ReplyMarkups;

namespace IntegrationTests.Admin;

/// <summary>
/// The owner's campaign broadcast against real Postgres, through the admin HTTP endpoints: three
/// audiences, a random test sample first and the rest later without anyone getting the message
/// twice, sending in parts, a web-app button with a given address, a record per recipient — and
/// the fact that nothing is ever sent without the explicit "send" call.
/// </summary>
public class BroadcastCampaignTests : TestBase
{
    private const long Owner = 4_000_000_001;
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
        await using var scope = _app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();
        await db.Database.ExecuteSqlRawAsync("""TRUNCATE "BroadcastCampaigns", "Referrals", "Users" CASCADE""");
        await AddUsers(1, 5, u => u.TelegramId = Owner);
    }

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private static long _nextTelegramId = 5_000_000_000;

    private Task<List<User>> AddUsers(int count, int registeredDaysAgo, Action<User>? configure = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var users = new List<User>();
        for (var i = 0; i < count; i++)
        {
            var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "User");
            user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-registeredDaysAgo);
            configure?.Invoke(user);
            db.Users.Add(user);
            users.Add(user);
        }
        await db.SaveChangesAsync(CancellationToken.None);
        foreach (var user in users)
        {
            db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        }
        await db.SaveChangesAsync(CancellationToken.None);
        return users;
    });

    private Task<List<User>> AccessEnded(int count) => AddUsers(count, registeredDaysAgo: 200);

    private async Task<(HttpStatusCode Code, JsonElement Body)> Call(HttpMethod method, string path, object? body = null, long as_ = Owner)
    {
        using var client = _app.ClientFor(as_);
        using var request = new HttpRequestMessage(method, $"/api/admin/{path}");
        if (body != null) request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }

    private async Task<JsonElement> Prepare(string key, string audience, int? sampleSize, bool dryRun = false,
        string message = "Позови друга — получи неделю", string? buttonText = "Открыть", string? buttonQuery = "")
    {
        var (code, body) = await Call(HttpMethod.Post, "campaigns/prepare",
            new { key, audience, message, buttonText, buttonQuery, sampleSize, dryRun });
        code.Should().Be(HttpStatusCode.OK, body.ValueKind == JsonValueKind.Undefined ? "" : body.GetRawText());
        return body;
    }

    private async Task<JsonElement> Send(string key, int limit = 100)
    {
        var (code, body) = await Call(HttpMethod.Post, $"campaigns/{key}/send", new { limit });
        code.Should().Be(HttpStatusCode.OK);
        return body;
    }

    private async Task<JsonElement> Status(string key) => (await Call(HttpMethod.Get, $"campaigns/{key}")).Body;

    /// <summary>Messages the bot sent since the given mark, by recipient.</summary>
    private List<SendMessageRequest> SentSince(int mark) =>
        _telegram.Requests.Skip(mark).OfType<SendMessageRequest>().ToList();

    private Task<List<BroadcastDelivery>> Deliveries(string key) => InScope(sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        return db.BroadcastDeliveries.AsNoTracking()
            .Where(d => db.BroadcastCampaigns.Any(c => c.Id == d.CampaignId && c.Key == key))
            .ToListAsync();
    });

    [Test]
    public async Task Audiences_are_split_the_way_the_paywall_sees_people()
    {
        await AccessEnded(6);
        await AddUsers(1, 200, u => u.BonusAccessUntilUtc = DateTime.UtcNow.AddDays(3)); // bonus week running → on trial
        await AddUsers(3, 10);                                                           // owner is on trial too → 5
        await AddUsers(1, 45, u => u.TrialBonusDays = 30);                               // friend with 60 days
        await AddUsers(2, 100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Month; u.SubscribedUntil = DateTime.UtcNow.AddDays(9); });
        await AddUsers(1, 100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Lifetime; });
        await AddUsers(1, 100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Month; u.SubscribedUntil = DateTime.UtcNow.AddDays(-9); });
        await AddUsers(4, 200, u => u.IsActive = false);             // blocked the bot — unreachable
        await AddUsers(2, 200, u => u.NotificationsEnabled = false); // asked not to be written to

        var (code, counts) = await Call(HttpMethod.Get, "campaigns/audiences");

        code.Should().Be(HttpStatusCode.OK);
        counts.GetProperty("accessEnded").GetInt32().Should().Be(6);
        counts.GetProperty("onTrial").GetInt32().Should().Be(6);
        counts.GetProperty("paying").GetInt32().Should().Be(3);
        counts.GetProperty("proLapsed").GetInt32().Should().Be(1);
        counts.GetProperty("owner").GetInt32().Should().Be(1);
    }

    [Test]
    public async Task Dry_run_counts_and_touches_nothing()
    {
        await AccessEnded(12);
        var mark = _telegram.Requests.Count;

        var result = await Prepare("dry-run", "accessEnded", sampleSize: 5, dryRun: true);

        result.GetProperty("dryRun").GetBoolean().Should().BeTrue();
        result.GetProperty("audienceTotal").GetInt32().Should().Be(12);
        result.GetProperty("picked").GetInt32().Should().Be(5);
        result.GetProperty("leftForLater").GetInt32().Should().Be(7);
        (await Call(HttpMethod.Get, "campaigns/dry-run")).Code.Should().Be(HttpStatusCode.NotFound);
        SentSince(mark).Should().BeEmpty();
    }

    [Test]
    public async Task Dry_run_is_the_default_when_the_flag_is_omitted()
    {
        await AccessEnded(3);

        var (code, body) = await Call(HttpMethod.Post, "campaigns/prepare",
            new { key = "no-flag", audience = "accessEnded", message = "текст" });

        code.Should().Be(HttpStatusCode.OK);
        body.GetProperty("dryRun").GetBoolean().Should().BeTrue();
        (await Deliveries("no-flag")).Should().BeEmpty();
    }

    [Test]
    public async Task Picking_recipients_sends_nothing_until_send_is_called()
    {
        await AccessEnded(8);
        var mark = _telegram.Requests.Count;

        await Prepare("picked-only", "accessEnded", sampleSize: null);

        (await Deliveries("picked-only")).Should().HaveCount(8).And.OnlyContain(d => d.Status == BroadcastDeliveryStatus.Pending);
        SentSince(mark).Should().BeEmpty();
    }

    [Test]
    public async Task Sample_first_then_the_rest_and_nobody_gets_it_twice()
    {
        var people = await AccessEnded(30);
        await AddUsers(5, 3); // on trial — not in this audience
        var mark = _telegram.Requests.Count;

        var sample = await Prepare("ref-test", "accessEnded", sampleSize: 10);
        sample.GetProperty("picked").GetInt32().Should().Be(10);
        sample.GetProperty("leftForLater").GetInt32().Should().Be(20);
        (await Send("ref-test")).GetProperty("sent").GetInt32().Should().Be(10);
        var sampleIds = SentSince(mark).Select(m => m.ChatId.Identifier!.Value).ToList();
        sampleIds.Should().HaveCount(10).And.OnlyHaveUniqueItems();

        var rest = await Prepare("ref-test", "accessEnded", sampleSize: null);
        rest.GetProperty("alreadyInCampaign").GetInt32().Should().Be(10);
        rest.GetProperty("picked").GetInt32().Should().Be(20);
        (await Send("ref-test")).GetProperty("sent").GetInt32().Should().Be(20);

        var everyone = SentSince(mark).Select(m => m.ChatId.Identifier!.Value).ToList();
        everyone.Should().BeEquivalentTo(people.Select(p => p.TelegramId), "each person in the audience got exactly one message");

        // Repeating either step changes nothing.
        (await Prepare("ref-test", "accessEnded", sampleSize: null)).GetProperty("picked").GetInt32().Should().Be(0);
        (await Prepare("ref-test", "accessEnded", sampleSize: 10)).GetProperty("picked").GetInt32().Should().Be(0);
        (await Send("ref-test")).GetProperty("sent").GetInt32().Should().Be(0);
        SentSince(mark).Should().HaveCount(30);

        var status = await Status("ref-test");
        status.GetProperty("total").GetInt32().Should().Be(30);
        status.GetProperty("sample").GetInt32().Should().Be(10);
        status.GetProperty("sent").GetInt32().Should().Be(30);
        status.GetProperty("pending").GetInt32().Should().Be(0);
        var rows = await Deliveries("ref-test");
        rows.Where(r => r.IsSample).Select(r => r.TelegramId).Should().BeEquivalentTo(sampleIds);
        rows.Should().OnlyContain(r => r.SentAtUtc != null);
    }

    [Test]
    public async Task The_sample_is_random_not_the_first_rows()
    {
        var people = await AccessEnded(40);
        var picks = new HashSet<string>();
        for (var i = 0; i < 4; i++)
        {
            await Prepare($"random-{i}", "accessEnded", sampleSize: 5);
            picks.Add(string.Join(',', (await Deliveries($"random-{i}")).Select(d => d.TelegramId).OrderBy(x => x)));
        }

        picks.Count.Should().BeGreaterThan(1, "four samples of 5 out of 40 coincide only if the choice is not random");
    }

    [Test]
    public async Task Sending_goes_in_parts_and_continues_where_it_stopped()
    {
        await AccessEnded(10);
        await Prepare("in-parts", "accessEnded", sampleSize: null);
        var mark = _telegram.Requests.Count;

        var first = await Send("in-parts", limit: 4);
        first.GetProperty("sent").GetInt32().Should().Be(4);
        first.GetProperty("status").GetProperty("pending").GetInt32().Should().Be(6);

        (await Send("in-parts", limit: 4)).GetProperty("sent").GetInt32().Should().Be(4);
        (await Send("in-parts", limit: 4)).GetProperty("sent").GetInt32().Should().Be(2);

        SentSince(mark).Select(m => m.ChatId.Identifier).Should().HaveCount(10).And.OnlyHaveUniqueItems();
    }

    [Test]
    public async Task One_request_never_sends_more_than_the_batch_limit()
    {
        await AccessEnded(BroadcastCampaignService.MaxBatchSize + 3);
        await Prepare("big", "accessEnded", sampleSize: null);

        var result = await Send("big", limit: 100_000);

        result.GetProperty("sent").GetInt32().Should().Be(BroadcastCampaignService.MaxBatchSize);
        result.GetProperty("status").GetProperty("pending").GetInt32().Should().Be(3);
    }

    [Test]
    public async Task Two_send_requests_at_once_do_not_double_send()
    {
        await AccessEnded(12);
        await Prepare("double-click", "accessEnded", sampleSize: null);
        var mark = _telegram.Requests.Count;

        var results = await Task.WhenAll(Send("double-click"), Send("double-click"), Send("double-click"));

        results.Sum(r => r.GetProperty("sent").GetInt32()).Should().Be(12);
        SentSince(mark).Select(m => m.ChatId.Identifier).Should().HaveCount(12).And.OnlyHaveUniqueItems();
    }

    [Test]
    public async Task The_button_opens_the_mini_app_at_the_given_address_and_carries_the_campaign()
    {
        await AccessEnded(1);
        await Prepare("with-button", "accessEnded", sampleSize: null,
            message: "Позови друга — получи неделю доступа", buttonText: "Позвать друга", buttonQuery: "?screen=vocabulary");
        var mark = _telegram.Requests.Count;

        await Send("with-button");

        var message = SentSince(mark).Single();
        message.Text.Should().Be("Позови друга — получи неделю доступа");
        var button = ((InlineKeyboardMarkup)message.ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Text.Should().Be("Позвать друга");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?screen=vocabulary&c=with-button");
    }

    [Test]
    public async Task Without_button_text_the_message_goes_without_a_button()
    {
        await AccessEnded(1);
        await Prepare("no-button", "accessEnded", sampleSize: null, buttonText: null, buttonQuery: null);
        var mark = _telegram.Requests.Count;

        await Send("no-button");

        SentSince(mark).Single().ReplyMarkup.Should().BeNull();
    }

    [Test]
    public async Task Owner_audience_sends_only_to_the_owner()
    {
        await AccessEnded(5);
        await Prepare("look-first", "owner", sampleSize: null);
        var mark = _telegram.Requests.Count;

        await Send("look-first");

        SentSince(mark).Select(m => m.ChatId.Identifier).Should().Equal(Owner);
    }

    [Test]
    public async Task People_who_joined_the_audience_later_are_picked_by_the_next_call_only()
    {
        await AccessEnded(3);
        await Prepare("grows", "accessEnded", sampleSize: null);
        await Send("grows");
        var late = await AccessEnded(2);
        var mark = _telegram.Requests.Count;

        (await Send("grows")).GetProperty("sent").GetInt32().Should().Be(0, "nobody is added without picking recipients again");
        (await Prepare("grows", "accessEnded", sampleSize: null)).GetProperty("picked").GetInt32().Should().Be(2);
        await Send("grows");

        SentSince(mark).Select(m => m.ChatId.Identifier!.Value).Should().BeEquivalentTo(late.Select(u => u.TelegramId));
    }

    [Test]
    public async Task Text_cannot_change_under_people_already_waiting_but_can_between_parts()
    {
        await AccessEnded(6);
        await Prepare("text", "accessEnded", sampleSize: 2, message: "первый текст");

        var (code, error) = await Call(HttpMethod.Post, "campaigns/prepare",
            new { key = "text", audience = "accessEnded", message = "второй текст", buttonText = "Открыть", buttonQuery = "", dryRun = false });
        code.Should().Be(HttpStatusCode.BadRequest);
        error.GetProperty("error").GetString().Should().Contain("ждут отправки");

        await Send("text");
        var mark = _telegram.Requests.Count;
        await Prepare("text", "accessEnded", sampleSize: null, message: "второй текст");
        await Send("text");

        SentSince(mark).Should().HaveCount(4).And.OnlyContain(m => m.Text == "второй текст");
    }

    [TestCase("ab", "accessEnded", "текст", "Открыть", "", Description = "key too short")]
    [TestCase("With Spaces", "accessEnded", "текст", "Открыть", "", Description = "key with spaces and capitals")]
    [TestCase("ok-key", "everyone", "текст", "Открыть", "", Description = "unknown audience")]
    [TestCase("ok-key", "2", "текст", "Открыть", "", Description = "audience as a number")]
    [TestCase("ok-key", "accessEnded", "  ", "Открыть", "", Description = "empty message")]
    [TestCase("ok-key", "accessEnded", "текст", "Открыть", "https://evil.example/", Description = "button address is not a query")]
    [TestCase("ok-key", "accessEnded", "текст", null, "screen=vocabulary", Description = "address without button text")]
    public async Task Bad_input_is_refused(string key, string audience, string message, string? buttonText, string buttonQuery)
    {
        await AccessEnded(2);

        var (code, _) = await Call(HttpMethod.Post, "campaigns/prepare",
            new { key, audience, message, buttonText, buttonQuery, dryRun = false });

        code.Should().Be(HttpStatusCode.BadRequest);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().BroadcastDeliveries.CountAsync())).Should().Be(0);
    }

    [Test]
    public async Task A_campaign_keeps_its_audience()
    {
        await AccessEnded(2);
        await Prepare("fixed-audience", "accessEnded", sampleSize: null);

        var (code, _) = await Call(HttpMethod.Post, "campaigns/prepare",
            new { key = "fixed-audience", audience = "onTrial", message = "Позови друга — получи неделю", buttonText = "Открыть", dryRun = false });

        code.Should().Be(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task Nobody_but_the_owner_can_see_or_send_campaigns()
    {
        var stranger = (await AccessEnded(3))[0];
        await Prepare("private", "accessEnded", sampleSize: null);
        var mark = _telegram.Requests.Count;

        (await Call(HttpMethod.Get, "campaigns/audiences", as_: stranger.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(HttpMethod.Get, "campaigns/private", as_: stranger.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(HttpMethod.Post, "campaigns/private/send", new { limit = 10 }, as_: stranger.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(HttpMethod.Post, "campaigns/prepare",
            new { key = "stranger", audience = "accessEnded", message = "спам", dryRun = false }, as_: stranger.TelegramId)).Code.Should().Be(HttpStatusCode.NotFound);

        SentSince(mark).Should().BeEmpty();
        (await Deliveries("stranger")).Should().BeEmpty();
    }

    [Test]
    public async Task Starting_the_application_sends_nothing_by_itself()
    {
        await AccessEnded(4);
        await Prepare("left-pending", "accessEnded", sampleSize: null);

        // A full copy of the application with every background worker running.
        await using var fresh = new TraleTestApplication(await InScope(sp =>
            Task.FromResult(sp.GetRequiredService<TraleDbContext>().Database.GetConnectionString()!)));
        var telegram = (TelegramClientFake)fresh.Services.GetRequiredService<ITelegramBotClient>();
        fresh.Services.GetServices<IHostedService>().Should().NotContain(s => s.GetType().Name.Contains("Broadcast") || s.GetType().Name.Contains("Campaign"));
        await Task.Delay(TimeSpan.FromSeconds(3));

        telegram.Requests.OfType<SendMessageRequest>().Should().BeEmpty();
        (await Deliveries("left-pending")).Should().OnlyContain(d => d.Status == BroadcastDeliveryStatus.Pending);
    }

    // ── What Telegram answers ────────────────────────────────────────────────

    /// <summary>Sender whose answers are scripted per recipient; everything else is delivered.</summary>
    private class ScriptedSender : ICampaignMessageSender
    {
        public ConcurrentDictionary<long, Queue<CampaignSendAttempt>> Script { get; } = new();
        public ConcurrentQueue<long> Attempts { get; } = new();

        public Task<CampaignSendAttempt> SendAsync(long telegramId, string text, string? buttonText, string? buttonQuery, string campaignKey, IReadOnlyList<string>? surveyOptions, CancellationToken ct)
        {
            Attempts.Enqueue(telegramId);
            return Task.FromResult(Script.TryGetValue(telegramId, out var answers) && answers.Count > 0
                ? answers.Dequeue()
                : new CampaignSendAttempt(CampaignSendOutcome.Sent));
        }
    }

    private Task<CampaignSendResult> SendWith(ScriptedSender sender, string key, int limit = 100) => InScope(sp =>
        new BroadcastCampaignService(sp.GetRequiredService<ITraleDbContext>(), sender, NullLoggerFactory.Instance)
            .SendBatchAsync(key, limit, CancellationToken.None));

    [Test]
    public async Task Blocked_bot_is_recorded_and_the_user_becomes_unreachable()
    {
        var people = await AccessEnded(3);
        await Prepare("blocked", "accessEnded", sampleSize: null);
        var sender = new ScriptedSender();
        sender.Script[people[1].TelegramId] = new Queue<CampaignSendAttempt>(new[] { new CampaignSendAttempt(CampaignSendOutcome.Blocked, Error: "Forbidden: bot was blocked by the user") });

        var result = await SendWith(sender, "blocked");

        result.Sent.Should().Be(2);
        result.Blocked.Should().Be(1);
        var row = (await Deliveries("blocked")).Single(d => d.TelegramId == people[1].TelegramId);
        row.Status.Should().Be(BroadcastDeliveryStatus.Blocked);
        row.SentAtUtc.Should().BeNull();
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == people[1].Id))).IsActive.Should().BeFalse();
        (await SendWith(sender, "blocked")).Sent.Should().Be(0);
        sender.Attempts.Should().HaveCount(3, "a blocked user is not tried again");
    }

    [Test]
    public async Task Rate_limit_stops_the_batch_and_the_refused_message_goes_later_once()
    {
        await AccessEnded(6);
        await Prepare("slow-down", "accessEnded", sampleSize: null);
        var third = (await Deliveries("slow-down")).OrderBy(d => d.CreatedAtUtc).ThenBy(d => d.Id).ElementAt(2).TelegramId;
        var sender = new ScriptedSender();
        sender.Script[third] = new Queue<CampaignSendAttempt>(new[] { new CampaignSendAttempt(CampaignSendOutcome.RateLimited, RetryAfterSeconds: 17) });

        var first = await SendWith(sender, "slow-down");

        first.Sent.Should().Be(2);
        first.RetryAfterSeconds.Should().Be(17);
        first.Status!.Pending.Should().Be(4);

        var second = await SendWith(sender, "slow-down");
        second.Sent.Should().Be(4);
        sender.Attempts.GroupBy(id => id).Where(g => g.Count() > 1).Select(g => g.Key).Should().Equal(third);
        (await Deliveries("slow-down")).Should().OnlyContain(d => d.Status == BroadcastDeliveryStatus.Sent);
    }

    [Test]
    public async Task No_answer_from_telegram_is_never_retried()
    {
        var people = await AccessEnded(3);
        await Prepare("no-answer", "accessEnded", sampleSize: null);
        var sender = new ScriptedSender();
        sender.Script[people[0].TelegramId] = new Queue<CampaignSendAttempt>(new[] { new CampaignSendAttempt(CampaignSendOutcome.Unknown, Error: "timeout") });

        var result = await SendWith(sender, "no-answer");
        await SendWith(sender, "no-answer");

        result.Unknown.Should().Be(1);
        sender.Attempts.Count(id => id == people[0].TelegramId).Should().Be(1);
        var status = await Status("no-answer");
        status.GetProperty("unknown").GetInt32().Should().Be(1);
        status.GetProperty("sent").GetInt32().Should().Be(2);
    }

    [Test]
    public async Task Rejected_by_telegram_is_recorded_with_the_reason()
    {
        var people = await AccessEnded(2);
        await Prepare("rejected", "accessEnded", sampleSize: null);
        var sender = new ScriptedSender();
        sender.Script[people[0].TelegramId] = new Queue<CampaignSendAttempt>(new[] { new CampaignSendAttempt(CampaignSendOutcome.Rejected, Error: "400: chat not found") });

        await SendWith(sender, "rejected");

        var row = (await Deliveries("rejected")).Single(d => d.TelegramId == people[0].TelegramId);
        row.Status.Should().Be(BroadcastDeliveryStatus.Rejected);
        row.Error.Should().Be("400: chat not found");
    }

    // ── Measuring ────────────────────────────────────────────────────────────

    private async Task<HttpStatusCode> OpenByButton(User user, string key)
    {
        using var client = _app.ClientFor(user.TelegramId);
        return (await client.PostAsJsonAsync("/api/miniapp/campaign-open", new { key })).StatusCode;
    }

    [Test]
    public async Task Opening_the_mini_app_by_the_button_is_recorded_once_for_a_recipient_only()
    {
        var people = await AccessEnded(2);
        var outsider = (await AddUsers(1, 3))[0];
        await Prepare("opens", "accessEnded", sampleSize: null);

        (await OpenByButton(people[0], "opens")).Should().Be(HttpStatusCode.OK);
        (await Deliveries("opens")).Should().OnlyContain(d => d.OpenedAtUtc == null, "nothing was sent yet");

        await Send("opens");
        await OpenByButton(people[0], "opens");
        var firstOpen = (await Deliveries("opens")).Single(d => d.UserId == people[0].Id).OpenedAtUtc;
        await OpenByButton(people[0], "opens");
        await OpenByButton(outsider, "opens");
        (await OpenByButton(people[1], "no-such-campaign")).Should().Be(HttpStatusCode.OK);

        firstOpen.Should().NotBeNull();
        var rows = await Deliveries("opens");
        rows.Single(d => d.UserId == people[0].Id).OpenedAtUtc.Should().Be(firstOpen);
        rows.Single(d => d.UserId == people[1].Id).OpenedAtUtc.Should().BeNull();
        (await Status("opens")).GetProperty("opened").GetInt32().Should().Be(1);
    }

    private static string Sql(string file) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Sql", file));

    private Task<List<Dictionary<string, object?>>> Query(string sql) => InScope(async sp =>
    {
        await using var connection = new NpgsqlConnection(sp.GetRequiredService<TraleDbContext>().Database.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync())
        {
            rows.Add(Enumerable.Range(0, reader.FieldCount)
                .ToDictionary(reader.GetName, i => reader.IsDBNull(i) ? null : reader.GetValue(i)));
        }
        return rows;
    });

    [Test]
    public async Task The_report_query_counts_the_funnel_of_a_campaign()
    {
        var people = await AccessEnded(8);
        await Prepare("report", "accessEnded", sampleSize: 3);
        var sampleIds = (await Deliveries("report")).Select(d => d.UserId).ToHashSet();
        var sender = new ScriptedSender();
        var sample = people.Where(p => sampleIds.Contains(p.Id)).ToList();
        sender.Script[sample[2].TelegramId] = new Queue<CampaignSendAttempt>(new[] { new CampaignSendAttempt(CampaignSendOutcome.Blocked) });
        await SendWith(sender, "report");
        await Prepare("report", "accessEnded", sampleSize: null);
        await SendWith(sender, "report", limit: 4); // one of the rest is not sent yet

        // sample[0]: opened by the button, invited two friends, one of them started learning.
        await OpenByButton(sample[0], "report");
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var friends = new[] { Create.User(Interlocked.Increment(ref _nextTelegramId), "F"), Create.User(Interlocked.Increment(ref _nextTelegramId), "F") };
            db.Users.AddRange(friends);
            await db.SaveChangesAsync(CancellationToken.None);
            db.Referrals.Add(new Referral { Id = Guid.NewGuid(), ReferrerUserId = sample[0].Id, RefereeUserId = friends[0].Id, CreatedAtUtc = DateTime.UtcNow.AddMinutes(1), ActivatedAtUtc = DateTime.UtcNow.AddMinutes(2), ActivationTrigger = "first_lesson", BonusReferrerDays = 7, BonusRefereeDays = 30 });
            db.Referrals.Add(new Referral { Id = Guid.NewGuid(), ReferrerUserId = sample[0].Id, RefereeUserId = friends[1].Id, CreatedAtUtc = DateTime.UtcNow.AddMinutes(1), BonusRefereeDays = 30 });
            // sample[1] came back by himself and played.
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress { Id = Guid.NewGuid(), UserId = sample[1].Id, LastPlayedAtUtc = DateTime.UtcNow.AddMinutes(5) });
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var sql = string.Join('\n', Sql("campaign-report.sql").Split('\n').Where(l => !l.TrimStart().StartsWith("--")))
            .Replace(":'campaign'", "'report'").Replace(":days", "7");
        var rows = (await Query(sql)).ToDictionary(r => (string)r["part"]!);

        rows.Keys.Should().BeEquivalentTo("sample", "rest", "all");
        Convert.ToInt32(rows["sample"]["picked"]).Should().Be(3);
        Convert.ToInt32(rows["sample"]["delivered"]).Should().Be(2);
        Convert.ToInt32(rows["sample"]["blocked"]).Should().Be(1);
        Convert.ToInt32(rows["sample"]["opened_by_button"]).Should().Be(1);
        Convert.ToInt32(rows["sample"]["active_after"]).Should().Be(1);
        Convert.ToInt32(rows["sample"]["inviters"]).Should().Be(1);
        Convert.ToInt32(rows["sample"]["friends_registered"]).Should().Be(2);
        Convert.ToInt32(rows["sample"]["bonuses_granted"]).Should().Be(1);
        Convert.ToInt32(rows["sample"]["inviters_rewarded"]).Should().Be(1);
        Convert.ToInt32(rows["rest"]["picked"]).Should().Be(5);
        Convert.ToInt32(rows["rest"]["delivered"]).Should().Be(4);
        Convert.ToInt32(rows["rest"]["not_sent_yet"]).Should().Be(1);
        Convert.ToInt32(rows["rest"]["friends_registered"]).Should().Be(0);
        Convert.ToInt32(rows["all"]["picked"]).Should().Be(8);
        Convert.ToInt32(rows["all"]["delivered"]).Should().Be(6);
    }

    [Test]
    public async Task The_short_changed_query_finds_whom_the_old_rule_gave_nothing_and_the_fix_returns_it()
    {
        // The old rule: +7 to TrialBonusDays whatever the state of the trial.
        async Task<User> Referrer(int registeredDaysAgo, int refereeDays, params int[] grantedDaysAgo)
        {
            var user = (await AddUsers(1, registeredDaysAgo, u => u.TrialBonusDays = refereeDays + 7 * grantedDaysAgo.Length))[0];
            await InScope(async sp =>
            {
                var db = sp.GetRequiredService<ITraleDbContext>();
                foreach (var daysAgo in grantedDaysAgo)
                {
                    var friend = Create.User(Interlocked.Increment(ref _nextTelegramId), "F");
                    db.Users.Add(friend);
                    await db.SaveChangesAsync(CancellationToken.None);
                    db.Referrals.Add(new Referral { Id = Guid.NewGuid(), ReferrerUserId = user.Id, RefereeUserId = friend.Id, CreatedAtUtc = DateTime.UtcNow.AddDays(-daysAgo).AddHours(-2), ActivatedAtUtc = DateTime.UtcNow.AddDays(-daysAgo), ActivationTrigger = "first_lesson", BonusReferrerDays = 7, BonusRefereeDays = 30 });
                }
                return await db.SaveChangesAsync(CancellationToken.None);
            });
            return user;
        }

        var lostAll = await Referrer(registeredDaysAgo: 200, refereeDays: 0, grantedDaysAgo: 20);      // trial ended 150 days before the grant
        var lostPart = await Referrer(registeredDaysAgo: 43, refereeDays: 0, grantedDaysAgo: 10);      // trial ended 3 days before the grant
        var lostNothing = await Referrer(registeredDaysAgo: 40, refereeDays: 0, grantedDaysAgo: 20);   // granted on day 20 of the trial
        var friendOnSixty = await Referrer(registeredDaysAgo: 80, refereeDays: 30, grantedDaysAgo: 30);// day 50 of a 60-day trial
        var twice = await Referrer(registeredDaysAgo: 300, refereeDays: 0, 40, 38);                    // two grants, both wasted

        var found = (await Query(Sql("referral-shortchanged.sql"))).ToDictionary(r => (long)r["telegram_id"]!, r => (TimeSpan)r["lost"]!);

        found.Keys.Should().BeEquivalentTo(new[] { lostAll.TelegramId, lostPart.TelegramId, twice.TelegramId });
        found[lostAll.TelegramId].Should().Be(TimeSpan.FromDays(7));
        found[lostPart.TelegramId].Should().BeCloseTo(TimeSpan.FromDays(3), TimeSpan.FromMinutes(1));
        found[twice.TelegramId].Should().Be(TimeSpan.FromDays(14));

        // The fix script as shipped rolls back; with COMMIT it gives the lost time from now.
        await Query(Sql("referral-shortchanged-fix.sql"));
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.CountAsync(u => u.BonusAccessUntilUtc != null))).Should().Be(0);

        var fixedRows = await Query(Sql("referral-shortchanged-fix.sql").Replace("ROLLBACK;", "COMMIT;"));
        fixedRows.Should().HaveCount(3);
        var users = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().ToDictionaryAsync(u => u.TelegramId));
        users[lostAll.TelegramId].BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromMinutes(1));
        users[lostPart.TelegramId].BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(3), TimeSpan.FromMinutes(2));
        users[twice.TelegramId].BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(14), TimeSpan.FromMinutes(1));
        users[lostAll.TelegramId].HasMiniAppAccess().Should().BeTrue();
        users[lostNothing.TelegramId].BonusAccessUntilUtc.Should().BeNull();
        users[friendOnSixty.TelegramId].BonusAccessUntilUtc.Should().BeNull();
    }
}
