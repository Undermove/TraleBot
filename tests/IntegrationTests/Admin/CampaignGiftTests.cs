using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;

namespace IntegrationTests.Admin;

/// <summary>
/// A campaign that gives days of access to whoever opens its button — over HTTP, against real
/// Postgres: the gift starts at the open, is given once whatever is repeated or raced, only to a
/// recipient, only until the offer ends, and never takes access away from anyone.
/// </summary>
public class CampaignGiftTests : TestBase
{
    private const long Owner = 4_100_000_001;
    private const int GiftDays = 3;
    private static readonly TimeSpan Slack = TimeSpan.FromMinutes(2);
    private static long _nextTelegramId = 6_000_000_000;

    private TraleTestApplication _app = null!;

    [OneTimeSetUp]
    public void StartSignedApp() => _app = _testServer.WithSignedLogin(Owner);

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CleanDatabase()
    {
        await InScope(sp => sp.GetRequiredService<TraleDbContext>().Database
            .ExecuteSqlRawAsync("""TRUNCATE "BroadcastCampaigns", "Referrals", "Users" CASCADE"""));
        await AddUser(5, u => u.TelegramId = Owner);
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

    private Task<User> AccessEnded() => AddUser(200);

    private Task<User> Reload(User user) => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == user.Id));

    private async Task<(HttpStatusCode Code, JsonElement Body)> Admin(HttpMethod method, string path, object? body = null)
    {
        using var client = _app.ClientFor(Owner);
        using var request = new HttpRequestMessage(method, $"/api/admin/{path}");
        if (body != null) request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }

    /// <summary>Picks everyone in the audience and sends — the people now hold the message with the button.</summary>
    private async Task Launch(string key, string audience, int giftDays = GiftDays, int? giftOfferDays = null, bool send = true)
    {
        var (code, body) = await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, audience, message = "Подарок", buttonText = "Открыть", buttonQuery = "screen=verbs",
            sampleSize = (int?)null, dryRun = false, giftDays, giftOfferDays
        });
        code.Should().Be(HttpStatusCode.OK, body.ValueKind == JsonValueKind.Undefined ? "" : body.GetRawText());
        if (send) (await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 100 })).Code.Should().Be(HttpStatusCode.OK);
    }

    private async Task<JsonElement> Status(string key) => (await Admin(HttpMethod.Get, $"campaigns/{key}")).Body;

    /// <summary>The gift in the answer to an open; null when the answer carries none.</summary>
    private async Task<JsonElement?> Open(User user, string key)
    {
        using var client = _app.ClientFor(user.TelegramId);
        var response = await client.PostAsJsonAsync("/api/miniapp/campaign-open", new { key });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var gift = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("gift");
        return gift.ValueKind == JsonValueKind.Null ? null : gift;
    }

    private Task<BroadcastDelivery> Delivery(User user, string key) => InScope(sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        return db.BroadcastDeliveries.AsNoTracking()
            .SingleAsync(d => d.UserId == user.Id && db.BroadcastCampaigns.Any(c => c.Id == d.CampaignId && c.Key == key));
    });

    private async Task<bool> SectionSaysAccess(User user)
    {
        using var client = _app.ClientFor(user.TelegramId);
        return (await client.GetFromJsonAsync<JsonElement>("/api/miniapp/verbs/section")).GetProperty("hasAccess").GetBoolean();
    }

    [Test]
    public async Task Gift_starts_at_the_open_and_is_given_once()
    {
        var person = await AccessEnded();
        await Launch("gift-once", "accessEnded");
        (await Reload(person)).HasMiniAppAccess().Should().BeFalse("sending the message gives nothing — the days must not burn unread");
        (await SectionSaysAccess(person)).Should().BeFalse();

        var first = await Open(person, "gift-once");
        var untilAfterFirst = (await Reload(person)).BonusAccessUntilUtc;
        var second = await Open(person, "gift-once");

        first.Should().NotBeNull();
        first!.Value.GetProperty("days").GetInt32().Should().Be(GiftDays);
        first.Value.GetProperty("accessUntilUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow.AddDays(GiftDays), Slack);
        second.Should().BeNull("the gift is said and given once");
        var after = await Reload(person);
        after.BonusAccessUntilUtc.Should().Be(untilAfterFirst).And.BeCloseTo(DateTime.UtcNow.AddDays(GiftDays), Slack);
        after.IsPro.Should().BeFalse();
        (await SectionSaysAccess(person)).Should().BeTrue();
        var delivery = await Delivery(person, "gift-once");
        delivery.GiftGrantedAtUtc.Should().NotBeNull();
        delivery.GiftAccessUntilUtc.Should().BeCloseTo(untilAfterFirst!.Value, TimeSpan.FromMilliseconds(1));
        (await Status("gift-once")).GetProperty("gifted").GetInt32().Should().Be(1);
    }

    [Test]
    public async Task Access_is_there_during_the_gift_and_gone_after_it()
    {
        var person = await AccessEnded();
        await Launch("gift-window", "accessEnded");
        await Open(person, "gift-window");

        var after = await Reload(person);

        after.HasMiniAppAccess(DateTime.UtcNow.AddDays(GiftDays).AddHours(-1)).Should().BeTrue();
        after.HasMiniAppAccess(DateTime.UtcNow.AddDays(GiftDays).AddHours(1)).Should().BeFalse("after the gift the person meets the usual paywall");
    }

    [Test]
    public async Task Many_opens_at_once_give_the_gift_exactly_once()
    {
        var person = await AccessEnded();
        await Launch("gift-race", "accessEnded");

        var gifts = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => Open(person, "gift-race")));

        gifts.Count(g => g != null).Should().Be(1);
        var after = await Reload(person);
        after.BonusAccessUntilUtc.Should().Be(gifts.Single(g => g != null)!.Value.GetProperty("accessUntilUtc").GetDateTime());
        (await Delivery(person, "gift-race")).GiftAccessUntilUtc.Should().BeCloseTo(after.BonusAccessUntilUtc!.Value, TimeSpan.FromMilliseconds(1));
    }

    [Test]
    public async Task Someone_who_was_not_sent_the_message_gets_nothing()
    {
        var recipient = await AccessEnded();
        await Launch("gift-forward", "accessEnded");
        var stranger = await AccessEnded(); // registered in the audience, but the campaign was picked before them

        (await Open(stranger, "gift-forward")).Should().BeNull("a forwarded link must not gift strangers");
        (await Open(stranger, "no-such-campaign")).Should().BeNull();

        (await Reload(stranger)).HasMiniAppAccess().Should().BeFalse();
        (await Reload(stranger)).BonusAccessUntilUtc.Should().BeNull();
        (await Open(recipient, "gift-forward")).Should().NotBeNull();
    }

    [Test]
    public async Task Picked_but_not_sent_yet_gets_nothing()
    {
        var person = await AccessEnded();
        await Launch("gift-pending", "accessEnded", send: false);

        (await Open(person, "gift-pending")).Should().BeNull();
        (await Reload(person)).HasMiniAppAccess().Should().BeFalse();
    }

    [Test]
    public async Task After_the_offer_ends_the_open_is_recorded_but_nothing_is_given()
    {
        var person = await AccessEnded();
        await Launch("gift-late", "accessEnded");
        (await Status("gift-late")).GetProperty("giftOfferEndsAtUtc").GetDateTime()
            .Should().BeCloseTo(DateTime.UtcNow.AddDays(14), Slack, "the offer runs 14 days from the campaign's creation unless said otherwise");
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            (await db.BroadcastCampaigns.SingleAsync(c => c.Key == "gift-late")).GiftOfferEndsAtUtc = DateTime.UtcNow.AddMinutes(-1);
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        (await Open(person, "gift-late")).Should().BeNull();

        (await Reload(person)).HasMiniAppAccess().Should().BeFalse();
        var delivery = await Delivery(person, "gift-late");
        delivery.OpenedAtUtc.Should().NotBeNull();
        delivery.GiftGrantedAtUtc.Should().BeNull();
    }

    [Test]
    public async Task Offer_length_can_be_set_and_a_campaign_without_a_gift_gives_none()
    {
        var person = await AccessEnded();
        await Launch("gift-week", "accessEnded", giftOfferDays: 7);
        (await Status("gift-week")).GetProperty("giftOfferEndsAtUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow.AddDays(7), Slack);

        var other = await AddUser(200, u => u.IsPro = false);
        await Launch("no-gift", "accessEnded", giftDays: 0);

        (await Open(other, "no-gift")).Should().BeNull();
        (await Reload(other)).HasMiniAppAccess().Should().BeFalse();
        (await Status("no-gift")).GetProperty("giftDays").GetInt32().Should().Be(0);
        person.Should().NotBeNull();
    }

    [Test]
    public async Task Nobody_loses_access_they_already_have()
    {
        var now = DateTime.UtcNow;
        var longTrial = await AddUser(10);                                                   // 20 days of trial left
        var shortTrial = await AddUser(29);                                                  // 1 day of trial left
        var longBonus = await AddUser(200, u => u.BonusAccessUntilUtc = now.AddDays(9));     // bonus week from a friend
        await Launch("gift-trial", "onTrial");

        (await Open(longTrial, "gift-trial")).Should().BeNull("more than three days are there already");
        (await Open(longBonus, "gift-trial")).Should().BeNull();
        var topUp = await Open(shortTrial, "gift-trial");

        (await Reload(longTrial)).Should().BeEquivalentTo(new { BonusAccessUntilUtc = (DateTime?)null, TrialBonusDays = 0 });
        (await Reload(longBonus)).BonusAccessUntilUtc.Should().BeCloseTo(now.AddDays(9), TimeSpan.FromSeconds(1));
        (await Delivery(longTrial, "gift-trial")).GiftGrantedAtUtc.Should().BeNull("nothing was given, so the offer stays open for them");
        topUp.Should().NotBeNull();
        (await Reload(shortTrial)).TrialEndsAtUtc.Should().BeCloseTo(now.AddDays(GiftDays), Slack, "at least three days from the open");
    }

    [Test]
    public async Task Paying_people_are_not_touched_and_a_lapsed_subscriber_gets_the_days()
    {
        var now = DateTime.UtcNow;
        var paying = await AddUser(100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Month; u.SubscribedUntil = now.AddDays(9); });
        var lifetime = await AddUser(100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Lifetime; });
        var lapsed = await AddUser(100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Month; u.SubscribedUntil = now.AddDays(-9); });
        await Launch("gift-paying", "paying");
        await Launch("gift-lapsed", "proLapsed");

        (await Open(paying, "gift-paying")).Should().BeNull();
        (await Open(lifetime, "gift-paying")).Should().BeNull();
        var gift = await Open(lapsed, "gift-lapsed");

        (await Reload(paying)).SubscribedUntil.Should().BeCloseTo(now.AddDays(9), TimeSpan.FromSeconds(1));
        (await Reload(lifetime)).Should().BeEquivalentTo(new { SubscribedUntil = (DateTime?)null, IsLifetime = true });
        gift.Should().NotBeNull();
        var after = await Reload(lapsed);
        after.HasMiniAppAccess(now.AddDays(2)).Should().BeTrue();
        after.HasMiniAppAccess(now.AddDays(GiftDays).AddHours(1)).Should().BeFalse();
    }

    [Test]
    public async Task Gift_needs_a_button_and_a_sane_number_of_days()
    {
        await AccessEnded();
        object Draft(int giftDays, string? buttonText, int? giftOfferDays = null) => new
        {
            key = "gift-bad", audience = "accessEnded", message = "Подарок", buttonText, buttonQuery = "",
            sampleSize = (int?)null, dryRun = false, giftDays, giftOfferDays
        };

        (await Admin(HttpMethod.Post, "campaigns/prepare", Draft(31, "Открыть"))).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Post, "campaigns/prepare", Draft(-1, "Открыть"))).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Post, "campaigns/prepare", Draft(3, null))).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Admin(HttpMethod.Post, "campaigns/prepare", Draft(3, "Открыть", giftOfferDays: 0))).Code.Should().Be(HttpStatusCode.BadRequest);

        (await Admin(HttpMethod.Get, "campaigns/gift-bad")).Code.Should().Be(HttpStatusCode.NotFound, "a refused draft creates nothing");
    }

    [Test]
    public async Task Status_counts_who_got_the_gift_played_and_paid_after_opening()
    {
        var people = new[] { await AccessEnded(), await AccessEnded(), await AccessEnded(), await AccessEnded() };
        await Launch("gift-funnel", "accessEnded");
        foreach (var person in people.Take(3)) await Open(person, "gift-funnel");
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var verb = new Verb
            {
                Id = Guid.NewGuid(), Lemma = "funnel-verb", Title = "t", Translation = "глагол", Kind = "pattern", PresentJson = "[]",
                CardJson = "{}", ContentHash = "test", CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
            };
            db.Verbs.Add(verb);
            VerbSession Session(User user, bool finished) => new()
            {
                Id = Guid.NewGuid(), UserId = user.Id, VerbId = verb.Id, PlanJson = "{}", StartedAtUtc = DateTime.UtcNow.AddMinutes(1),
                UpdatedAtUtc = DateTime.UtcNow.AddMinutes(1), FinishedAtUtc = finished ? DateTime.UtcNow.AddMinutes(3) : null
            };
            db.VerbSessions.AddRange(Session(people[0], true), Session(people[1], false), Session(people[3], true));
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(), UserId = people[0].Id, TelegramPaymentChargeId = "c1", PayloadId = "p1",
                Plan = SubscriptionPlan.Month, Amount = 1, Currency = "XTR", PurchasedAtUtc = DateTime.UtcNow.AddMinutes(5)
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        var status = await Status("gift-funnel");

        status.GetProperty("opened").GetInt32().Should().Be(3);
        status.GetProperty("gifted").GetInt32().Should().Be(3);
        status.GetProperty("playedVerbSession").GetInt32().Should().Be(2, "the one who played without opening the button is not this campaign's result");
        status.GetProperty("finishedVerbSession").GetInt32().Should().Be(1);
        status.GetProperty("paidAfterOpen").GetInt32().Should().Be(1);
        status.GetProperty("giftDays").GetInt32().Should().Be(GiftDays);

        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Verbs.RemoveRange(await db.Verbs.Where(v => v.Lemma == "funnel-verb").ToListAsync());
            return await db.SaveChangesAsync(CancellationToken.None);
        });
    }
}
