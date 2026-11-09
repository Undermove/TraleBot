using System.Net.Http.Json;
using System.Text.Json;
using Application.Common;
using Application.MiniApp;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Fakes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Telegram.Bot;
using Telegram.Bot.Requests;

namespace IntegrationTests.MiniApp;

/// <summary>
/// Prices go up on a set day for everyone who has not paid before; until then the paywall says when, and
/// whoever paid before keeps the old prices for good — both in the cards and in the invoice.
/// </summary>
public class PriceRiseTests : TestBase
{
    private const long Owner = 4_000_000_101;
    private static long _nextTelegramId = 6_100_000_000;

    private TraleTestApplication App(DateTime riseAtUtc) => _testServer.WithSignedLogin(Owner, services =>
    {
        services.RemoveAll<PriceSchedule>();
        services.AddSingleton(new PriceSchedule { RiseAtUtc = riseAtUtc });
    });

    private static async Task<User> NewUser(TraleTestApplication app, DateTime? paidAt = null, bool refunded = false)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "Buyer");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-200);
        db.Users.Add(user);
        if (paidAt != null)
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(), UserId = user.Id, TelegramPaymentChargeId = Guid.NewGuid().ToString(),
                PayloadId = "Stars_Pro_Month", Plan = SubscriptionPlan.Month, Amount = 100, Currency = "XTR",
                PurchasedAtUtc = paidAt.Value, RefundedAtUtc = refunded ? paidAt.Value.AddDays(1) : null
            });
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    }

    private static async Task<JsonElement> Plans(TraleTestApplication app, User user)
    {
        using var client = app.ClientFor(user.TelegramId);
        return await client.GetFromJsonAsync<JsonElement>("/api/miniapp/plans");
    }

    private static int Stars(JsonElement plans, string plan) =>
        plans.GetProperty("plans").EnumerateArray().Single(p => p.GetProperty("id").GetString() == plan).GetProperty("stars").GetInt32();

    private static async Task<int> InvoiceStars(TraleTestApplication app, User user, string plan)
    {
        var telegram = (TelegramClientFake)app.Services.GetRequiredService<ITelegramBotClient>();
        var mark = telegram.Requests.Count;
        using var client = app.ClientFor(user.TelegramId);
        (await client.PostAsJsonAsync("/api/miniapp/purchase", new { plan })).EnsureSuccessStatusCode();
        return telegram.Requests.Skip(mark).OfType<CreateInvoiceLinkRequest>().Single().Prices.Single().Amount;
    }

    [Test]
    public async Task Before_the_rise_everyone_pays_the_old_price_and_hears_when_it_goes_up()
    {
        var riseAt = DateTime.UtcNow.AddDays(10);
        await using var app = App(riseAt);
        var user = await NewUser(app);

        var plans = await Plans(app, user);

        Stars(plans, "Month").Should().Be(100);
        Stars(plans, "Year").Should().Be(849);
        plans.GetProperty("plans")[0].GetProperty("regularStars").GetInt32().Should().Be(149);
        plans.GetProperty("pricesRiseAtUtc").GetDateTime().Should().BeCloseTo(riseAt, TimeSpan.FromSeconds(1));
        plans.GetProperty("keepsOldPrices").GetBoolean().Should().BeFalse();
        (await InvoiceStars(app, user, "Quarter")).Should().Be(249);
    }

    [Test]
    public async Task After_the_rise_a_new_buyer_pays_the_new_price()
    {
        await using var app = App(DateTime.UtcNow.AddDays(-1));
        var user = await NewUser(app);

        var plans = await Plans(app, user);

        Stars(plans, "Month").Should().Be(149);
        Stars(plans, "Quarter").Should().Be(349);
        Stars(plans, "HalfYear").Should().Be(649);
        Stars(plans, "Year").Should().Be(1199);
        plans.GetProperty("pricesRiseAtUtc").ValueKind.Should().Be(JsonValueKind.Null);
        (await InvoiceStars(app, user, "Year")).Should().Be(1199);
    }

    [Test]
    public async Task Whoever_paid_before_the_rise_keeps_the_old_prices_for_good()
    {
        var riseAt = DateTime.UtcNow.AddDays(-1);
        await using var app = App(riseAt);
        var loyal = await NewUser(app, paidAt: riseAt.AddDays(-30));

        var plans = await Plans(app, loyal);

        plans.GetProperty("keepsOldPrices").GetBoolean().Should().BeTrue();
        Stars(plans, "Month").Should().Be(100);
        (await InvoiceStars(app, loyal, "Quarter")).Should().Be(249);
    }

    [Test]
    public async Task A_refunded_payment_or_one_after_the_rise_does_not_keep_the_old_prices()
    {
        var riseAt = DateTime.UtcNow.AddDays(-5);
        await using var app = App(riseAt);
        var refunded = await NewUser(app, paidAt: riseAt.AddDays(-30), refunded: true);
        var paidAfter = await NewUser(app, paidAt: riseAt.AddDays(1));

        Stars(await Plans(app, refunded), "Month").Should().Be(149);
        Stars(await Plans(app, paidAfter), "Month").Should().Be(149);
    }
}
