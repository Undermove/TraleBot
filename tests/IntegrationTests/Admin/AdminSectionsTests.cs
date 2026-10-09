using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Fakes;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Telegram.Bot;
using Telegram.Bot.Requests;
using Trale.Controllers;
using User = Domain.Entities.User;

namespace IntegrationTests.Admin;

/// <summary>
/// The admin's sections over HTTP, against real Postgres: the overview numbers, the list of people
/// and a person's card, payments, the list of campaigns and a broadcast built step by step — and
/// the rule that every admin endpoint, present and future, answers only the owner.
/// </summary>
public class AdminSectionsTests : TestBase
{
    private const long Owner = 4_400_000_001;
    private static long _nextTelegramId = 9_000_000_000;

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
        await AddUser(3, u => u.TelegramId = Owner);
    }

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private Task<User> AddUser(int registeredDaysAgo, Action<User>? configure = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "User");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-registeredDaysAgo);
        configure?.Invoke(user);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    });

    private static void Subscribed(User u, int untilDays, SubscriptionPlan plan = SubscriptionPlan.Month)
    {
        u.IsPro = true;
        u.SubscriptionPlan = plan;
        u.SubscribedUntil = plan == SubscriptionPlan.Lifetime ? null : DateTime.UtcNow.AddDays(untilDays);
    }

    private Task<int> Seed(Action<ITraleDbContext> add) => InScope(sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        add(db);
        return db.SaveChangesAsync(CancellationToken.None);
    });

    private static Payment Paid(User user, int daysAgo, int stars, SubscriptionPlan plan = SubscriptionPlan.Month, bool refunded = false) => new()
    {
        Id = Guid.NewGuid(), UserId = user.Id, PurchasedAtUtc = DateTime.UtcNow.AddDays(-daysAgo), Amount = stars, Plan = plan,
        TelegramPaymentChargeId = Guid.NewGuid().ToString("N"), PayloadId = $"Stars_Pro_{plan}", Currency = "XTR",
        RefundedAtUtc = refunded ? DateTime.UtcNow.AddDays(-daysAgo).AddHours(1) : null
    };

    private static MiniAppUserProgress Played(User user, double daysAgo, string lessons = "{}") => new()
    {
        Id = Guid.NewGuid(), UserId = user.Id, LastPlayedAtUtc = DateTime.UtcNow.AddDays(-daysAgo), CompletedLessonsJson = lessons
    };

    private async Task<(HttpStatusCode Code, JsonElement Body)> Call(long telegramId, HttpMethod method, string path, object? body = null)
    {
        using var client = _app.ClientFor(telegramId);
        using var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 || text[0] != '{' ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }

    private Task<(HttpStatusCode Code, JsonElement Body)> Admin(HttpMethod method, string path, object? body = null) =>
        Call(Owner, method, $"/api/admin/{path}", body);

    private async Task<JsonElement> Get(string path)
    {
        var (code, body) = await Admin(HttpMethod.Get, path);
        code.Should().Be(HttpStatusCode.OK, path);
        return body;
    }

    private List<SendMessageRequest> SentTo(User user, int since) =>
        _telegram.Requests.Skip(since).OfType<SendMessageRequest>().Where(m => m.ChatId.Identifier == user.TelegramId).ToList();

    // ── Только владелец ──────────────────────────────────────────────────────

    /// <summary>Every action of the admin controller, as a request: found by reflection, so an endpoint added
    /// tomorrow is checked without anyone remembering to add it here.</summary>
    private static List<(HttpMethod Method, string Path)> AdminEndpoints() =>
        typeof(AdminController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(m => m.GetCustomAttributes<HttpMethodAttribute>().Select(a => (
                Method: new HttpMethod(a.HttpMethods.Single()),
                Path: "/api/admin/" + System.Text.RegularExpressions.Regex.Replace(a.Template ?? "", @"\{(\w+)(:\w+)?\}", g => g.Groups[2].Value == ":long" ? "1" : "some-key"))))
            .ToList();

    [Test]
    public async Task Every_admin_endpoint_answers_only_the_owner()
    {
        var stranger = await AddUser(10);
        var paying = await AddUser(100, u => Subscribed(u, 20));
        var endpoints = AdminEndpoints();
        var mark = _telegram.Requests.Count;
        using var anonymous = _app.CreateClient();

        endpoints.Count.Should().BeGreaterThanOrEqualTo(37, "every action of the controller is found");
        endpoints.Select(e => e.Path).Should().Contain(new[]
        {
            "/api/admin/overview", "/api/admin/users", "/api/admin/payments", "/api/admin/campaigns", "/api/admin/feedback/threads",
            "/api/admin/feedback/threads/1/reply", "/api/admin/campaigns/some-key/send", "/api/admin/jobs"
        });
        foreach (var (method, path) in endpoints)
        {
            foreach (var who in new[] { stranger.TelegramId, paying.TelegramId })
            {
                var (code, _) = await Call(who, method, path, method == HttpMethod.Get ? null : new { });
                code.Should().Be(HttpStatusCode.NotFound, $"{method} {path} must not tell a non-owner it exists");
            }
            using var request = new HttpRequestMessage(method, path);
            if (method != HttpMethod.Get) request.Content = JsonContent.Create(new { });
            (await anonymous.SendAsync(request)).StatusCode.Should().Be(HttpStatusCode.NotFound, $"{method} {path} without a signed login");
        }

        _telegram.Requests.Skip(mark).Should().BeEmpty("nothing was sent on a stranger's word");
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().BroadcastCampaigns.CountAsync())).Should().Be(0);
        (await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == paying.Id))).IsPro.Should().BeTrue();
    }

    // ── Обзор ────────────────────────────────────────────────────────────────

    [Test]
    public async Task The_overview_gives_the_main_numbers_and_what_waits_in_each_section()
    {
        var fresh = await AddUser(2);
        var studiedToday = await AddUser(100);
        var studiedThisWeek = await AddUser(100);
        var studiedLongAgo = await AddUser(100);
        var paying = await AddUser(100, u => Subscribed(u, 20));
        var lifetime = await AddUser(100, u => Subscribed(u, 0, SubscriptionPlan.Lifetime));
        var lapsed = await AddUser(100, u => Subscribed(u, -5));
        await Seed(db =>
        {
            db.MiniAppUserProgresses.AddRange(Played(studiedToday, 0.2), Played(studiedThisWeek, 5), Played(studiedLongAgo, 40));
            db.Payments.AddRange(Paid(paying, 10, 100), Paid(lifetime, 29, 600, SubscriptionPlan.Lifetime), Paid(lapsed, 45, 100), Paid(fresh, 3, 100, refunded: true));
        });
        (await Call(studiedLongAgo.TelegramId, HttpMethod.Post, "/api/miniapp/feedback", new { text = "Есть вопрос" })).Code.Should().Be(HttpStatusCode.OK);
        await Admin(HttpMethod.Post, "campaigns/prepare", new { key = "", newBroadcast = true, audience = "accessEnded", message = "Привет", dryRun = false, sampleSize = 1 });
        await Admin(HttpMethod.Post, "campaigns/prepare", new { key = "", newBroadcast = true, newBroadcastSuffix = "test", audience = "owner", message = "Себе", dryRun = false });

        var overview = await Get("overview");

        int N(string name) => overview.GetProperty(name).GetInt32();
        N("totalUsers").Should().Be(8);
        N("newUsers7d").Should().Be(2, "the fresh one and the owner");
        N("studiedToday").Should().Be(1);
        N("studied7d").Should().Be(2);
        N("payments30d").Should().Be(2, "refunds and older payments are not counted");
        overview.GetProperty("stars30d").GetInt64().Should().Be(700);
        N("activeSubscriptions").Should().Be(2);
        N("onTrial").Should().Be(2);
        N("unansweredMessages").Should().Be(1);
        N("unfinishedBroadcasts").Should().Be(1, "a trial sent to oneself is not something left unfinished");
        N("unfinishedSurveys").Should().Be(0);
        N("verbsToReview").Should().BeGreaterThanOrEqualTo(0);
    }

    // ── Пользователи ─────────────────────────────────────────────────────────

    [Test]
    public async Task People_are_listed_most_recently_active_first_with_filters_search_and_pages()
    {
        var paying = await AddUser(100, u => { Subscribed(u, 20); u.AcquisitionSource = "seo_grammar_cases"; });
        var lapsed = await AddUser(100, u => Subscribed(u, -5));
        var trial = await AddUser(5);
        var ended = await AddUser(200);
        var blocked = await AddUser(200, u => u.IsActive = false);
        await Seed(db => db.MiniAppUserProgresses.AddRange(Played(ended, 1), Played(paying, 3), Played(lapsed, 50)));

        var all = await Get("users");
        var onlyPaying = await Get("users?filter=paying");
        var onlyEnded = await Get("users?filter=accessEnded");
        var onlyBlocked = await Get("users?filter=blocked");
        var onlyTrial = await Get("users?filter=trial");
        var found = await Get($"users?search={paying.TelegramId.ToString()[4..]}");
        var secondPage = await Get("users?skip=2&take=2");

        static List<long> Ids(JsonElement page) => page.GetProperty("users").EnumerateArray().Select(u => u.GetProperty("telegramId").GetInt64()).ToList();
        all.GetProperty("total").GetInt32().Should().Be(6);
        Ids(all).Take(3).Should().Equal(ended.TelegramId, paying.TelegramId, Owner);
        Ids(onlyPaying).Should().Equal(paying.TelegramId);
        Ids(onlyEnded).Should().BeEquivalentTo(new[] { ended.TelegramId, blocked.TelegramId, lapsed.TelegramId }, "no access now — never paid or lapsed");
        Ids(onlyBlocked).Should().Equal(blocked.TelegramId);
        Ids(onlyTrial).Should().BeEquivalentTo(new[] { trial.TelegramId, Owner });
        Ids(found).Should().Equal(paying.TelegramId);
        Ids(secondPage).Should().Equal(Ids(all).Skip(2).Take(2));
        secondPage.GetProperty("total").GetInt32().Should().Be(6);
        var counts = all.GetProperty("counts");
        (counts.GetProperty("all").GetInt32(), counts.GetProperty("paying").GetInt32(), counts.GetProperty("trial").GetInt32(), counts.GetProperty("accessEnded").GetInt32(), counts.GetProperty("blocked").GetInt32())
            .Should().Be((6, 1, 2, 3, 1));
        var row = onlyPaying.GetProperty("users")[0];
        row.GetProperty("access").GetString().Should().Be("paying");
        row.GetProperty("acquisitionSource").GetString().Should().Be("seo_grammar_cases");
        row.GetProperty("lastActivityUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow.AddDays(-3), TimeSpan.FromMinutes(5));
        onlyBlocked.GetProperty("users")[0].GetProperty("isActive").GetBoolean().Should().BeFalse();
        onlyEnded.GetProperty("users").EnumerateArray().Select(u => u.GetProperty("access").GetString()).Should().BeEquivalentTo("ended", "ended", "lapsed");
        (await Admin(HttpMethod.Get, "users?filter=everyone")).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Get, "users?sort=height")).Code.Should().Be(HttpStatusCode.BadRequest);

        await Seed(db => db.VocabularyEntries.Add(new VocabularyEntry
        {
            Id = Guid.NewGuid(), UserId = lapsed.Id, Word = "ძაღლი", Definition = "собака", AdditionalInfo = "", Example = "",
            DateAddedUtc = DateTime.UtcNow.AddDays(-60), UpdatedAtUtc = DateTime.UtcNow.AddDays(-60), Language = Language.Georgian
        }));
        var byWords = await Get("users?sort=words");
        var byRegistration = await Get("users?sort=registered");
        Ids(byWords)[0].Should().Be(lapsed.TelegramId);
        byWords.GetProperty("users")[0].GetProperty("vocabularyCount").GetInt32().Should().Be(1);
        Ids(byRegistration).Take(2).Should().Equal(Owner, trial.TelegramId);
    }

    [Test]
    public async Task A_persons_card_says_where_they_came_from_what_they_did_what_they_paid_and_what_they_said()
    {
        var person = await AddUser(100, u => { Subscribed(u, 20); u.AcquisitionSource = "ref_309149393"; });
        await Seed(db =>
        {
            db.MiniAppUserProgresses.Add(Played(person, 2, """{"alphabet-progressive":[1,2,3],"numbers":[1]}"""));
            db.Payments.Add(Paid(person, 10, 100));
            db.Quizzes.Add(new UserQuiz { Id = Guid.NewGuid(), UserId = person.Id, DateStarted = DateTime.UtcNow.AddDays(-1) });
        });
        await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "card-survey", audience = "paying", dryRun = false, sampleSize = (int?)null,
            survey = new { questions = new object[] { new { text = "Насколько TraleBot тебе нужен?", kind = "choice", options = new[] { "Без него никак", "Могу и без него" } }, new { text = "Что было неудобно?", kind = "text" } } }
        });
        await Admin(HttpMethod.Post, "campaigns/card-survey/send", new { limit = 10 });
        await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/surveys/card-survey/answer", new { questionId = "q1", option = "Без него никак" });
        await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/surveys/card-survey/answer", new { questionId = "q2", text = "Долгие уроки" });

        var card = await Get($"users/{person.TelegramId}");

        card.GetProperty("acquisitionSource").GetString().Should().Be("ref_309149393");
        card.GetProperty("access").GetString().Should().Be("Paying");
        card.GetProperty("accessUntilUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow.AddDays(20), TimeSpan.FromMinutes(5));
        card.GetProperty("lastStudiedAtUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow.AddDays(-1), TimeSpan.FromMinutes(5));
        card.GetProperty("lessonsCompleted").GetInt32().Should().Be(4);
        card.GetProperty("quizzesStarted").GetInt32().Should().Be(1);
        card.GetProperty("writtenTexts").GetInt32().Should().Be(1);
        card.GetProperty("payments").EnumerateArray().Single().GetProperty("amount").GetInt32().Should().Be(100);
        card.GetProperty("surveyAnswers").EnumerateArray().Select(a => (a.GetProperty("question").GetString(), a.GetProperty("option").GetString(), a.GetProperty("text").GetString()))
            .Should().BeEquivalentTo(new[] { ("Насколько TraleBot тебе нужен?", "Без него никак", (string?)null), ("Что было неудобно?", null, "Долгие уроки") });
        (await Admin(HttpMethod.Get, "users/1")).Code.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Оплаты ───────────────────────────────────────────────────────────────

    [Test]
    public async Task Payments_are_listed_newest_first_with_those_whose_subscription_ends_soon_or_has_just_ended()
    {
        var endsSoon = await AddUser(100, u => Subscribed(u, 5));
        var endsLater = await AddUser(100, u => Subscribed(u, 60));
        var endedLately = await AddUser(100, u => Subscribed(u, -10, SubscriptionPlan.Quarter));
        var endedLongAgo = await AddUser(300, u => Subscribed(u, -90));
        var forever = await AddUser(100, u => Subscribed(u, 0, SubscriptionPlan.Lifetime));
        await Seed(db => db.Payments.AddRange(
            Paid(endsSoon, 25, 100), Paid(endsLater, 1, 600, SubscriptionPlan.Year), Paid(endedLately, 100, 250, SubscriptionPlan.Quarter),
            Paid(endedLongAgo, 120, 100, refunded: true), Paid(forever, 50, 900, SubscriptionPlan.Lifetime)));

        var all = await Get("payments");
        var page = await Get("payments?skip=1&take=2");

        all.GetProperty("total").GetInt32().Should().Be(5);
        all.GetProperty("starsTotal").GetInt64().Should().Be(1850);
        all.GetProperty("refunds").GetInt32().Should().Be(1);
        all.GetProperty("payments").EnumerateArray().Select(p => p.GetProperty("telegramId").GetInt64())
            .Should().Equal(endsLater.TelegramId, endsSoon.TelegramId, forever.TelegramId, endedLately.TelegramId, endedLongAgo.TelegramId);
        var first = all.GetProperty("payments")[0];
        (first.GetProperty("plan").GetString(), first.GetProperty("amount").GetInt32(), first.GetProperty("currency").GetString()).Should().Be(("Year", 600, "XTR"));
        all.GetProperty("payments")[4].GetProperty("refundedAtUtc").ValueKind.Should().NotBe(JsonValueKind.Null);
        page.GetProperty("payments").EnumerateArray().Select(p => p.GetProperty("telegramId").GetInt64()).Should().Equal(endsSoon.TelegramId, forever.TelegramId);
        all.GetProperty("endingSoon").EnumerateArray().Select(s => s.GetProperty("telegramId").GetInt64()).Should().Equal(endsSoon.TelegramId);
        all.GetProperty("endedLately").EnumerateArray().Select(s => (s.GetProperty("telegramId").GetInt64(), s.GetProperty("plan").GetString()))
            .Should().Equal((endedLately.TelegramId, "Quarter"));
    }

    // ── Рассылки ─────────────────────────────────────────────────────────────

    private Task<(HttpStatusCode Code, JsonElement Body)> NewBroadcast(string audience, int? sampleSize = null, int giftDays = 0, string? suffix = null, bool dryRun = false) =>
        Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "", newBroadcast = true, newBroadcastSuffix = suffix, audience, message = "Новые уроки про падежи\nЗагляни!", buttonText = "Открыть",
            buttonQuery = "screen=verbs", giftDays, sampleSize, dryRun
        });

    private static string Stem => $"broadcast-{DateTime.UtcNow:yyyy-MM}";

    [Test]
    public async Task A_broadcast_names_itself_and_the_list_shows_how_far_each_campaign_got()
    {
        var people = new[] { await AddUser(200), await AddUser(200), await AddUser(200) };

        var counted = await NewBroadcast("accessEnded", dryRun: true);
        var first = await NewBroadcast("accessEnded", sampleSize: 2, giftDays: 3);
        var second = await NewBroadcast("accessEnded");
        var toMyself = await NewBroadcast("owner", suffix: "test");
        var badSuffix = await NewBroadcast("owner", suffix: "Bad Suffix!");
        await Admin(HttpMethod.Post, $"campaigns/{Stem}/send", new { limit = 1 });
        var opened = people.First(p => SentTo(p, 0).Count > 0);
        await Call(opened.TelegramId, HttpMethod.Post, "/api/miniapp/campaign-open", new { key = Stem });
        await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "listed-survey", audience = "accessEnded", dryRun = true, sampleSize = (int?)null,
            survey = new { questions = new object[] { new { text = "Вопрос", kind = "choice", options = new[] { "Да", "Нет" } } } }
        });

        counted.Body.GetProperty("key").GetString().Should().Be(Stem);
        first.Body.GetProperty("key").GetString().Should().Be(Stem, "counting did not take the name");
        second.Body.GetProperty("key").GetString().Should().Be($"{Stem}-2");
        toMyself.Body.GetProperty("key").GetString().Should().Be($"{Stem}-test");
        badSuffix.Code.Should().Be(HttpStatusCode.BadRequest);
        var listed = (await Get("campaigns")).GetProperty("campaigns").EnumerateArray().ToList();
        listed.Select(c => c.GetProperty("key").GetString()).Should().BeEquivalentTo(new[] { Stem, $"{Stem}-2" }, "a trial sent to oneself is not listed");
        var sending = listed.Single(c => c.GetProperty("key").GetString() == Stem);
        (sending.GetProperty("state").GetString(), sending.GetProperty("picked").GetInt32(), sending.GetProperty("pending").GetInt32(), sending.GetProperty("sent").GetInt32(),
                sending.GetProperty("opened").GetInt32(), sending.GetProperty("gifted").GetInt32(), sending.GetProperty("giftDays").GetInt32())
            .Should().Be(("running", 2, 1, 1, 1, 1, 3));
        sending.GetProperty("message").GetString().Should().StartWith("Новые уроки про падежи");
        sending.GetProperty("isSurvey").GetBoolean().Should().BeFalse();
        (await Get("campaigns?surveys=true")).GetProperty("campaigns").GetArrayLength().Should().Be(0, "counting a survey created nothing");
        (await Get("campaigns?surveys=false")).GetProperty("campaigns").GetArrayLength().Should().Be(2);

        await Admin(HttpMethod.Post, $"campaigns/{Stem}/send", new { limit = 10 });
        (await Get("campaigns")).GetProperty("campaigns").EnumerateArray().Single(c => c.GetProperty("key").GetString() == Stem)
            .GetProperty("state").GetString().Should().Be("done");
    }

    [Test]
    public async Task One_more_audience_joins_the_same_campaign_so_nobody_gets_the_message_or_the_gift_twice()
    {
        // In both audiences: access ended AND studied lately.
        var both = await AddUser(200);
        var onlyEnded = await AddUser(200);
        var onlyActive = await AddUser(3);
        await Seed(db => db.MiniAppUserProgresses.Add(Played(both, 1)));
        var mark = _telegram.Requests.Count;
        var key = (await NewBroadcast("accessEnded", giftDays: 3)).Body.GetProperty("key").GetString()!;
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 100 });
        object Part(string audience, bool another) => new
        {
            key, audience, message = "Новые уроки про падежи\nЗагляни!", buttonText = "Открыть", buttonQuery = "screen=verbs", giftDays = 3,
            sampleSize = (int?)null, dryRun = false, anotherAudience = another
        };

        var refused = await Admin(HttpMethod.Post, "campaigns/prepare", Part("activeLately", another: false));
        var joined = await Admin(HttpMethod.Post, "campaigns/prepare", Part("activeLately", another: true));
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 100 });
        var gift = await Call(both.TelegramId, HttpMethod.Post, "/api/miniapp/campaign-open", new { key });
        var giftAgain = await Call(both.TelegramId, HttpMethod.Post, "/api/miniapp/campaign-open", new { key });

        refused.Code.Should().Be(HttpStatusCode.BadRequest, "another audience is added only when asked for in so many words");
        joined.Code.Should().Be(HttpStatusCode.OK);
        joined.Body.GetProperty("alreadyInCampaign").GetInt32().Should().Be(1, "the one who is in both audiences");
        joined.Body.GetProperty("picked").GetInt32().Should().Be(2, "the new one and the owner");
        SentTo(both, mark).Should().ContainSingle();
        SentTo(onlyEnded, mark).Should().ContainSingle();
        SentTo(onlyActive, mark).Should().ContainSingle();
        gift.Body.GetProperty("gift").GetProperty("days").GetInt32().Should().Be(3);
        giftAgain.Body.GetProperty("gift").ValueKind.Should().Be(JsonValueKind.Null);
        (await Get("campaigns")).GetProperty("campaigns").EnumerateArray().Single().GetProperty("picked").GetInt32().Should().Be(4);
    }
}
