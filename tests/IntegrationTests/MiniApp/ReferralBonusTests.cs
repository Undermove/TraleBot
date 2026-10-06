using System.Net.Http.Json;
using System.Text.Json;
using Application.Common;
using Application.MiniApp.Commands;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot.Requests;

namespace IntegrationTests.MiniApp;

/// <summary>
/// The referral promise against real Postgres: whoever invites a friend gets days they can actually
/// use. A referrer whose trial ended long ago gets a week counted from the activation, a referrer on
/// trial gets the week at the end of the trial, a lapsed subscriber gets the subscription back, the
/// friend still gets 60 days — and <c>/api/miniapp/me</c> and <c>/api/miniapp/referral</c> say the
/// same thing the database does.
/// </summary>
public class ReferralBonusTests : TestBase
{
    private static readonly TimeSpan Tolerance = TimeSpan.FromSeconds(30);
    private TraleTestApplication _app = null!;

    [OneTimeSetUp]
    public void StartSignedApp() => _app = _testServer.WithSignedLogin(ownerTelegramId: 1);

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _testServer.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private Task<User> NewUser(int registeredDaysAgo, Action<User>? configure = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Random.Shared.NextInt64(1_000_000, long.MaxValue / 2), "Referrer");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-registeredDaysAgo);
        configure?.Invoke(user);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    });

    private Task<User> Reload(User user) => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == user.Id));

    /// <summary>A friend who came by the link more than an hour ago and has not done anything yet.</summary>
    private Task<Referral> Invite(User referrer, DateTime? activatedAt = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var friend = Create.User(Random.Shared.NextInt64(1_000_000, long.MaxValue / 2), "Friend");
        db.Users.Add(friend);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = friend.Id, CurrentLanguage = Language.Georgian });
        var referral = new Referral
        {
            Id = Guid.NewGuid(),
            ReferrerUserId = referrer.Id,
            RefereeUserId = friend.Id,
            CreatedAtUtc = (activatedAt ?? DateTime.UtcNow).AddHours(-2),
            ActivatedAtUtc = activatedAt,
            ActivationTrigger = activatedAt == null ? null : "first_lesson",
            BonusReferrerDays = activatedAt == null ? 0 : TryActivateReferralService.ReferrerTrialBonusDays,
            BonusRefereeDays = RecordReferralLinkService.RefereeTrialBonusDays
        };
        db.Referrals.Add(referral);
        await db.SaveChangesAsync(CancellationToken.None);
        return referral;
    });

    private Task<ReferralActivation> Activate(Referral referral) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var tracked = await db.Referrals.SingleAsync(r => r.Id == referral.Id);
        return await sp.GetRequiredService<TryActivateReferralService>()
            .ActivateAsync(tracked, "first_lesson", CancellationToken.None);
    });

    /// <summary>The friend adds five words — one of the things that count as "started learning".</summary>
    private Task<int> FriendAddsFiveWords(Referral referral) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        for (var i = 0; i < 5; i++)
        {
            db.VocabularyEntries.Add(new VocabularyEntry
            {
                Id = Guid.NewGuid(), Word = $"слово {i}", Definition = $"word {i}", AdditionalInfo = "", Example = "",
                DateAddedUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow,
                UserId = referral.RefereeUserId, Language = Language.Georgian
            });
        }
        return await db.SaveChangesAsync(CancellationToken.None);
    });

    private Task<int> ProcessPending() => InScope(sp =>
        sp.GetRequiredService<ProcessPendingReferralsService>().ExecuteAsync(CancellationToken.None));

    private async Task<JsonElement> Get(User user, string path)
    {
        using var client = _app.ClientFor(user.TelegramId);
        var response = await client.GetAsync($"/api/miniapp/{path}");
        response.IsSuccessStatusCode.Should().BeTrue($"{path} → {(int)response.StatusCode}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private IEnumerable<string> MessagesTo(User user) => TelegramClientFake.Requests
        .OfType<SendMessageRequest>()
        .Where(r => r.ChatId.Identifier == user.TelegramId)
        .Select(r => r.Text);

    [Test]
    public async Task Referrer_whose_trial_ended_long_ago_gets_a_week_from_now()
    {
        var referrer = await NewUser(registeredDaysAgo: 200);

        var before = await Get(referrer, "me");
        before.GetProperty("hasAccess").GetBoolean().Should().BeFalse();
        var offerBefore = await Get(referrer, "referral");
        offerBefore.GetProperty("state").GetString().Should().Be("accessEnded");
        offerBefore.GetProperty("bonusShortLabel").GetString().Should().Be("неделя доступа");
        offerBefore.GetProperty("inviteLine").GetString().Should().Be("Позови друга — получишь неделю доступа");

        var referral = await Invite(referrer);
        await FriendAddsFiveWords(referral);
        await ProcessPending();

        var after = await Reload(referrer);
        after.BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), Tolerance);
        after.TrialBonusDays.Should().Be(0, "days added to a trial that ended 170 days ago would bring nothing back");
        after.RegisteredAtUtc.Should().BeCloseTo(referrer.RegisteredAtUtc, TimeSpan.FromMilliseconds(1));
        after.HasMiniAppAccess().Should().BeTrue();

        var me = await Get(referrer, "me");
        me.GetProperty("hasAccess").GetBoolean().Should().BeTrue();
        me.GetProperty("isTrialActive").GetBoolean().Should().BeTrue();
        me.GetProperty("isPro").GetBoolean().Should().BeFalse();
        me.GetProperty("trialDaysLeft").GetInt32().Should().Be(7);
        me.GetProperty("shouldShowReferralExtensionCta").GetBoolean().Should().BeFalse();

        var offerAfter = await Get(referrer, "referral");
        offerAfter.GetProperty("state").GetString().Should().Be("trial");
        offerAfter.GetProperty("bonusShortLabel").GetString().Should().Be("+7 дней к пробному");
        offerAfter.GetProperty("activatedCount").GetInt32().Should().Be(1);

        var local = after.BonusAccessUntilUtc!.Value.AddHours(4);
        MessagesTo(referrer).Should().ContainSingle()
            .Which.Should().StartWith($"Твой друг начал заниматься — тебе открыта неделя, до {local.Day} ");
    }

    [Test]
    public async Task Referrer_on_trial_gets_seven_days_at_the_end_of_the_trial()
    {
        var referrer = await NewUser(registeredDaysAgo: 10);

        var activation = await Activate(await Invite(referrer));

        activation.Result.Should().Be(TryActivateReferralResult.Activated);
        activation.Bonus.Should().Be(ReferralBonusKind.TrialExtended);
        var after = await Reload(referrer);
        after.TrialBonusDays.Should().Be(7);
        after.BonusAccessUntilUtc.Should().BeNull();
        after.TrialEndsAtUtc.Should().BeCloseTo(referrer.RegisteredAtUtc.AddDays(37), TimeSpan.FromMilliseconds(1));
        (await Get(referrer, "me")).GetProperty("trialDaysLeft").GetInt32().Should().Be(27);
    }

    [Test]
    public async Task Second_friend_during_the_bonus_week_extends_it()
    {
        var referrer = await NewUser(registeredDaysAgo: 90);

        await Activate(await Invite(referrer));
        var second = await Activate(await Invite(referrer));

        second.Bonus.Should().Be(ReferralBonusKind.FreeWeek);
        var after = await Reload(referrer);
        after.BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(14), Tolerance);
        (await Get(referrer, "me")).GetProperty("trialDaysLeft").GetInt32().Should().Be(14);
    }

    [Test]
    public async Task Friend_after_the_bonus_week_is_over_starts_a_new_week_from_now()
    {
        var referrer = await NewUser(registeredDaysAgo: 90, u => u.BonusAccessUntilUtc = DateTime.UtcNow.AddDays(-20));

        await Activate(await Invite(referrer));

        (await Reload(referrer)).BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), Tolerance);
    }

    [Test]
    public async Task Trial_that_ended_yesterday_gets_a_full_week_not_six_days()
    {
        var referrer = await NewUser(registeredDaysAgo: 31);

        await Activate(await Invite(referrer));

        (await Reload(referrer)).TrialEndsAtUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), Tolerance);
    }

    [Test]
    public async Task Lapsed_subscriber_gets_fourteen_days_of_subscription_from_now()
    {
        var referrer = await NewUser(registeredDaysAgo: 120, u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = DateTime.UtcNow.AddDays(-40);
        });
        var offer = await Get(referrer, "referral");
        offer.GetProperty("state").GetString().Should().Be("pro");
        offer.GetProperty("bonusShortLabel").GetString().Should().Be("+14 дней подписки");

        var activation = await Activate(await Invite(referrer));

        activation.Bonus.Should().Be(ReferralBonusKind.ProExtended);
        var after = await Reload(referrer);
        after.SubscribedUntil.Should().BeCloseTo(DateTime.UtcNow.AddDays(14), Tolerance);
        after.BonusAccessUntilUtc.Should().BeNull();
        after.TrialBonusDays.Should().Be(0);
        var me = await Get(referrer, "me");
        me.GetProperty("isPro").GetBoolean().Should().BeTrue();
        me.GetProperty("isTrialActive").GetBoolean().Should().BeFalse();
    }

    [Test]
    public async Task Active_subscriber_gets_fourteen_days_after_the_current_end()
    {
        var until = DateTime.UtcNow.AddDays(20);
        var referrer = await NewUser(registeredDaysAgo: 120, u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = until;
        });

        await Activate(await Invite(referrer));

        (await Reload(referrer)).SubscribedUntil.Should().BeCloseTo(until.AddDays(14), TimeSpan.FromMilliseconds(1));
    }

    [Test]
    public async Task Lifetime_gets_nothing_and_is_offered_nothing()
    {
        var referrer = await NewUser(registeredDaysAgo: 120, u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        var activation = await Activate(await Invite(referrer));

        activation.Bonus.Should().Be(ReferralBonusKind.None);
        (await Reload(referrer)).BonusAccessUntilUtc.Should().BeNull();
        var offer = await Get(referrer, "referral");
        offer.GetProperty("state").GetString().Should().Be("lifetime");
        offer.GetProperty("bonusShortLabel").GetString().Should().BeEmpty();
        offer.GetProperty("inviteLine").GetString().Should().BeEmpty();
    }

    [Test]
    public async Task Sixth_friend_on_the_same_day_gives_nothing()
    {
        var referrer = await NewUser(registeredDaysAgo: 90);
        for (var i = 0; i < TryActivateReferralService.DailyActivationCap; i++)
        {
            (await Activate(await Invite(referrer))).Result.Should().Be(TryActivateReferralResult.Activated);
        }
        var untilBefore = (await Reload(referrer)).BonusAccessUntilUtc;

        var sixth = await Activate(await Invite(referrer));

        sixth.Result.Should().Be(TryActivateReferralResult.DailyCapReached);
        untilBefore.Should().BeCloseTo(DateTime.UtcNow.AddDays(35), Tolerance);
        (await Reload(referrer)).BonusAccessUntilUtc.Should().Be(untilBefore);
    }

    [Test]
    public async Task Seventh_friend_in_a_year_gives_nothing_and_the_offer_reports_the_cap()
    {
        var referrer = await NewUser(registeredDaysAgo: 300);
        for (var i = 0; i < TryActivateReferralService.YearlyActivationCap; i++)
        {
            await Invite(referrer, activatedAt: DateTime.UtcNow.AddDays(-30 - i));
        }

        var seventh = await Activate(await Invite(referrer));

        seventh.Result.Should().Be(TryActivateReferralResult.YearlyCapReached);
        var after = await Reload(referrer);
        after.BonusAccessUntilUtc.Should().BeNull();
        after.HasMiniAppAccess().Should().BeFalse();
        (await Get(referrer, "referral")).GetProperty("capReached").GetBoolean().Should().BeTrue();
    }

    [Test]
    public async Task Activation_earlier_than_an_hour_after_the_friend_came_is_postponed()
    {
        var referrer = await NewUser(registeredDaysAgo: 90);
        var referral = await Invite(referrer);
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            (await db.Referrals.SingleAsync(r => r.Id == referral.Id)).CreatedAtUtc = DateTime.UtcNow.AddMinutes(-30);
            return await db.SaveChangesAsync(CancellationToken.None);
        });

        (await Activate(referral)).Result.Should().Be(TryActivateReferralResult.TooEarly);
        (await Reload(referrer)).HasMiniAppAccess().Should().BeFalse();
    }

    [Test]
    public async Task Friend_who_registers_by_the_link_through_the_bot_gets_sixty_days()
    {
        var referrer = await NewUser(registeredDaysAgo: 200);
        var friendTelegramId = Random.Shared.NextInt64(1_000_000, long.MaxValue / 2);
        using var client = _testServer.CreateClient();

        var response = await client.PostAsync("/telegram/test_token",
            Create.TelegramUpdate(Random.Shared.Next(), friendTelegramId, $"/start ref_{referrer.TelegramId}").ToJsonContent());

        response.IsSuccessStatusCode.Should().BeTrue();
        var (friend, referral) = await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(u => u.TelegramId == friendTelegramId);
            return (user, await db.Referrals.AsNoTracking().SingleAsync(r => r.RefereeUserId == user.Id));
        });
        friend.TrialBonusDays.Should().Be(30);
        friend.TrialDaysLeft().Should().Be(60);
        referral.ReferrerUserId.Should().Be(referrer.Id);
        referral.ActivatedAtUtc.Should().BeNull("the referrer is rewarded only when the friend starts learning");
        (await Reload(referrer)).HasMiniAppAccess().Should().BeFalse();
        TelegramClientFake.Requests.OfType<SendMessageRequest>()
            .Where(r => r.ChatId.Identifier == friendTelegramId).Select(r => r.Text)
            .Should().Contain(t => t.Contains("60 дней бесплатно вместо 30"));
    }

    [Test]
    public async Task Someone_who_already_used_the_bot_is_not_a_new_friend()
    {
        var referrer = await NewUser(registeredDaysAgo: 200);
        var oldTimer = await NewUser(registeredDaysAgo: 100);
        using var client = _testServer.CreateClient();

        await client.PostAsync("/telegram/test_token",
            Create.TelegramUpdate(Random.Shared.Next(), oldTimer.TelegramId, $"/start ref_{referrer.TelegramId}").ToJsonContent());

        var referrals = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Referrals
            .CountAsync(r => r.RefereeUserId == oldTimer.Id));
        referrals.Should().Be(0);
        (await Reload(oldTimer)).TrialBonusDays.Should().Be(0);
    }

    [Test]
    public async Task What_a_user_sends_to_a_friend_and_reads_in_the_rules_has_no_jargon()
    {
        var onTrial = await NewUser(registeredDaysAgo: 3);

        var offer = await Get(onTrial, "referral");

        offer.GetProperty("state").GetString().Should().Be("trial");
        offer.GetProperty("link").GetString().Should().Be($"https://t.me/traletestmock_bot?start=ref_{onTrial.TelegramId}");
        offer.GetProperty("shareText").GetString().Should()
            .Be("Учу грузинский в TraleBot 🇬🇪 Заходи по моей ссылке — тебе дадут 60 дней бесплатно вместо 30.");
        offer.GetProperty("inviteLine").GetString().Should().Be("Позови друга — получишь +7 дней к пробному периоду");
        var everything = offer.GetRawText();
        everything.Should().NotContainEquivalentOf("триал").And.NotContainEquivalentOf("стака");
    }
}
