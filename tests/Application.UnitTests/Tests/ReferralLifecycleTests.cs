using Application.MiniApp;
using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// End-to-end coverage of the buy ↔ invite ↔ activate flow. These chain together
/// ActivateProStars (purchase) and TryActivateReferralService (friend activation)
/// to verify the entitlement helpers on User produce the right totals across
/// realistic sequences. Use these to answer "if I bought a sub and then invited
/// a friend, does my subscription extend?" with concrete numbers.
/// </summary>
public class ReferralLifecycleTests : CommandTestsBase
{
    private ActivateProStars.Handler _purchase = null!;
    private TryActivateReferralService _activator = null!;
    private RecordReferralLinkService _record = null!;

    [SetUp]
    public void SetUp()
    {
        _purchase = new ActivateProStars.Handler(Context, NullLoggerFactory.Instance);
        _activator = new TryActivateReferralService(Context, NullLoggerFactory.Instance);
        _record = new RecordReferralLinkService(Context, NullLoggerFactory.Instance);
    }

    private async Task<Referral> Invite(User referrer)
    {
        var newUser = await CreateFreeUser();
        newUser.RegisteredAtUtc = DateTime.UtcNow;
        await Context.SaveChangesAsync();
        await _record.ExecuteAsync(newUser.Id, referrer.TelegramId, CancellationToken.None);
        var row = Context.Referrals.First(r => r.RefereeUserId == newUser.Id);
        // Backdate creation past the 1-hour anti-fraud window.
        row.CreatedAtUtc = DateTime.UtcNow.AddHours(-2);
        await Context.SaveChangesAsync();
        return row;
    }

    [Test]
    public async Task ProUserInvitesFriend_SubscriptionExtendsBy30Days()
    {
        // Bought a Month plan; sub ends in 20 days.
        var user = await CreateFreeUser();
        user.TelegramId = 100;
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-2);
        await Context.SaveChangesAsync();
        await _purchase.Handle(
            new ActivateProStars { UserId = user.Id, Payload = "Stars_Pro_Month" },
            CancellationToken.None);
        var beforeInvite = Context.Users.First(u => u.Id == user.Id).SubscribedUntil!.Value;

        var referral = await Invite(Context.Users.First(u => u.Id == user.Id));
        var result = await _activator.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.SubscribedUntil.ShouldBe(beforeInvite.AddDays(TryActivateReferralService.ReferrerProBonusDays));
        updated.HasActivePro().ShouldBeTrue();
    }

    [Test]
    public async Task TrialUserInvitesFriend_TrialBonusDaysGrows_AndPersistsThroughPurchase()
    {
        // Trial user, registered today. Invites & activates one friend.
        var user = await CreateFreeUser();
        user.TelegramId = 101;
        user.RegisteredAtUtc = DateTime.UtcNow;
        user.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        var referral = await Invite(Context.Users.First(u => u.Id == user.Id));
        await _activator.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        var afterInvite = Context.Users.First(u => u.Id == user.Id);
        afterInvite.TrialBonusDays.ShouldBe(TryActivateReferralService.ReferrerTrialBonusDays);
        afterInvite.HasActiveTrial().ShouldBeTrue();

        // Now buys Month plan — purchase should stack on the bonus-extended trial.
        await _purchase.Handle(
            new ActivateProStars { UserId = user.Id, Payload = "Stars_Pro_Month" },
            CancellationToken.None);

        var afterPurchase = Context.Users.First(u => u.Id == user.Id);
        afterPurchase.HasActivePro().ShouldBeTrue();
        // SubscribedUntil ≈ (RegisteredAt + 30 + 7) + 30 = RegisteredAt + 67 days.
        var expected = user.RegisteredAtUtc.AddDays(User.TrialDays + TryActivateReferralService.ReferrerTrialBonusDays + 30);
        afterPurchase.SubscribedUntil!.Value.ShouldBe(expected, TimeSpan.FromSeconds(2));
    }

    [Test]
    public async Task MultipleInvitesWhilePro_StackUntilDailyCap()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 102;
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-1);
        await Context.SaveChangesAsync();
        await _purchase.Handle(
            new ActivateProStars { UserId = user.Id, Payload = "Stars_Pro_Month" },
            CancellationToken.None);
        var initialSubscribedUntil = Context.Users.First(u => u.Id == user.Id).SubscribedUntil!.Value;

        // Invite & activate 5 friends today — that's the daily cap exactly.
        for (var i = 0; i < TryActivateReferralService.DailyActivationCap; i++)
        {
            var referral = await Invite(Context.Users.First(u => u.Id == user.Id));
            var r = await _activator.ExecuteAsync(referral, "first_lesson", CancellationToken.None);
            r.ShouldBe(TryActivateReferralResult.Activated);
        }
        // Sixth attempt today hits the cap.
        var sixth = await Invite(Context.Users.First(u => u.Id == user.Id));
        var capped = await _activator.ExecuteAsync(sixth, "first_lesson", CancellationToken.None);

        capped.ShouldBe(TryActivateReferralResult.DailyCapReached);
        var final = Context.Users.First(u => u.Id == user.Id);
        var expected = initialSubscribedUntil.AddDays(
            TryActivateReferralService.DailyActivationCap * TryActivateReferralService.ReferrerProBonusDays);
        final.SubscribedUntil.ShouldBe(expected);
    }

    [Test]
    public async Task ExpiredProUserInvitesFriend_FallsBackToTrialBonus()
    {
        // Edge case to document: user paid for Pro, sub lapsed, then a friend activates.
        // Current behaviour: TrialBonusDays += 7 (entitlement helper picks trial-style
        // because HasActivePro is false). The 7 days are absorbed but don't translate to
        // access until the user buys again — they remain in the renewal-prompt audience.
        var user = await CreateFreeUser();
        user.TelegramId = 103;
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-60);
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Month;
        user.SubscribedUntil = DateTime.UtcNow.AddDays(-2);
        user.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        var referral = await Invite(Context.Users.First(u => u.Id == user.Id));
        var result = await _activator.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.HasExpiredPro().ShouldBeTrue();
        updated.TrialBonusDays.ShouldBe(TryActivateReferralService.ReferrerTrialBonusDays);
        // Critically: TrialBonusDays did NOT grant access (IsPro stored flag stays true).
        updated.HasActiveTrial().ShouldBeFalse();
        updated.HasMiniAppAccess().ShouldBeFalse();
    }

    [Test]
    public async Task LifetimeUserInvitesFriend_NoBonusButCounterIncrements()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 104;
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-30);
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Lifetime;
        user.SubscribedUntil = null;
        await Context.SaveChangesAsync();

        var referral = await Invite(Context.Users.First(u => u.Id == user.Id));
        var result = await _activator.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.SubscribedUntil.ShouldBeNull();
        updated.TrialBonusDays.ShouldBe(0);
        updated.IsLifetime.ShouldBeTrue();
        // Counter via Referrals row.
        var row = Context.Referrals.First(r => r.Id == referral.Id);
        row.ActivatedAtUtc.ShouldNotBeNull();
        row.BonusReferrerDays.ShouldBe(0);
    }
}
