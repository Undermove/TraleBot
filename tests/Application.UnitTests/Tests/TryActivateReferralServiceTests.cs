using Application.MiniApp;
using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Application.UnitTests.Tests;

public class TryActivateReferralServiceTests : CommandTestsBase
{
    private TryActivateReferralService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new TryActivateReferralService(Context, NullLoggerFactory.Instance);
    }

    private async Task<Referral> AddPendingReferral(Guid referrerId, DateTime? createdAt = null)
    {
        // Default: created 2 hours ago so the 1-hour anti-fraud window has passed.
        var created = createdAt ?? DateTime.UtcNow.AddHours(-2);
        var refereeId = Guid.NewGuid();
        var row = new Referral
        {
            Id = Guid.NewGuid(),
            ReferrerUserId = referrerId,
            RefereeUserId = refereeId,
            CreatedAtUtc = created,
            ActivatedAtUtc = null,
            ActivationTrigger = null,
            BonusReferrerDays = 0,
            BonusRefereeDays = RecordReferralLinkService.RefereeTrialBonusDays
        };
        Context.Referrals.Add(row);
        await Context.SaveChangesAsync();
        return row;
    }

    [Test]
    public async Task ShouldExtendTrialBy7Days_WhenReferrerIsOnActiveTrial()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-5);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();
        var referral = await AddPendingReferral(referrer.Id);

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.TrialBonusDays.ShouldBe(TryActivateReferralService.ReferrerTrialBonusDays);
        var trialDaysLeft = (updated.TrialEndsAtUtc - DateTime.UtcNow).TotalDays;
        // Was 25 days left (30-5), now should be ~32.
        trialDaysLeft.ShouldBeInRange(31, 33);
    }

    [Test]
    public async Task ShouldStackTrialBonus_WhenMultipleFriendsActivate()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-2);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        var r1 = await AddPendingReferral(referrer.Id);
        var r2 = await AddPendingReferral(referrer.Id);
        var r3 = await AddPendingReferral(referrer.Id);

        await _sut.ExecuteAsync(r1, "first_lesson", CancellationToken.None);
        await _sut.ExecuteAsync(r2, "vocab_5", CancellationToken.None);
        await _sut.ExecuteAsync(r3, "purchase", CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.TrialBonusDays.ShouldBe(3 * TryActivateReferralService.ReferrerTrialBonusDays);
    }

    [Test]
    public async Task ShouldGrantBonus_EvenWhenTrialAlreadyExpired()
    {
        // Registered 35 days ago: base trial ended 5 days ago.
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-35);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();
        referrer.TrialEndsAtUtc.ShouldBeLessThan(DateTime.UtcNow);

        var referral = await AddPendingReferral(referrer.Id);
        await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == referrer.Id);
        // The bonus is recorded into TrialBonusDays even though the +7 days isn't
        // enough to revive an expired trial in this case (35-day-old user, 5 days
        // overdue, +7 → trial would end 2 days in the future). It DOES revive.
        updated.TrialBonusDays.ShouldBe(TryActivateReferralService.ReferrerTrialBonusDays);
        updated.TrialEndsAtUtc.ShouldBeGreaterThan(DateTime.UtcNow);
    }

    [Test]
    public async Task ShouldExtendProSubscriptionBy30Days_WhenReferrerIsPro()
    {
        var referrer = await CreateFreeUser();
        referrer.IsPro = true;
        referrer.SubscriptionPlan = SubscriptionPlan.Month;
        var subscribedUntil = DateTime.UtcNow.AddDays(20);
        referrer.SubscribedUntil = subscribedUntil;
        await Context.SaveChangesAsync();
        var referral = await AddPendingReferral(referrer.Id);

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.SubscribedUntil.ShouldBe(subscribedUntil.AddDays(TryActivateReferralService.ReferrerProBonusDays));
    }

    [Test]
    public async Task ShouldStackProBonus_WhenMultipleFriendsActivate()
    {
        var referrer = await CreateFreeUser();
        referrer.IsPro = true;
        referrer.SubscriptionPlan = SubscriptionPlan.Month;
        var subscribedUntil = DateTime.UtcNow.AddDays(15);
        referrer.SubscribedUntil = subscribedUntil;
        await Context.SaveChangesAsync();

        var r1 = await AddPendingReferral(referrer.Id);
        var r2 = await AddPendingReferral(referrer.Id);

        await _sut.ExecuteAsync(r1, "first_lesson", CancellationToken.None);
        await _sut.ExecuteAsync(r2, "vocab_5", CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.SubscribedUntil.ShouldBe(subscribedUntil.AddDays(2 * TryActivateReferralService.ReferrerProBonusDays));
    }

    [Test]
    public async Task ShouldNotChangeAnything_WhenReferrerIsLifetime()
    {
        var referrer = await CreateFreeUser();
        referrer.IsPro = true;
        referrer.SubscriptionPlan = SubscriptionPlan.Lifetime;
        referrer.SubscribedUntil = null;
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-10);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();
        var referral = await AddPendingReferral(referrer.Id);

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.Activated);
        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.SubscribedUntil.ShouldBeNull();
        updated.TrialBonusDays.ShouldBe(0);

        var activated = Context.Referrals.First(r => r.Id == referral.Id);
        activated.BonusReferrerDays.ShouldBe(0);
        activated.ActivatedAtUtc.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldReturnTooEarly_WhenWithinAntiFraudWindow()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-5);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();
        var referral = await AddPendingReferral(referrer.Id, DateTime.UtcNow.AddMinutes(-5));

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.TooEarly);
        Context.Users.First(u => u.Id == referrer.Id).TrialBonusDays.ShouldBe(0);
        Context.Referrals.First(r => r.Id == referral.Id).ActivatedAtUtc.ShouldBeNull();
    }

    [Test]
    public async Task ShouldReturnAlreadyActivated_WhenReferralAlreadyHasActivatedAtUtc()
    {
        var referrer = await CreateFreeUser();
        var referral = await AddPendingReferral(referrer.Id);
        referral.ActivatedAtUtc = DateTime.UtcNow.AddDays(-1);
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.AlreadyActivated);
    }

    [Test]
    public async Task ShouldReturnDailyCapReached_WhenReferrerHas5ActivationsToday()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-1);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        for (var i = 0; i < TryActivateReferralService.DailyActivationCap; i++)
        {
            Context.Referrals.Add(new Referral
            {
                Id = Guid.NewGuid(),
                ReferrerUserId = referrer.Id,
                RefereeUserId = Guid.NewGuid(),
                CreatedAtUtc = DateTime.UtcNow.AddHours(-3),
                ActivatedAtUtc = DateTime.UtcNow.AddHours(-1),
                BonusReferrerDays = TryActivateReferralService.ReferrerTrialBonusDays,
                BonusRefereeDays = RecordReferralLinkService.RefereeTrialBonusDays
            });
        }
        await Context.SaveChangesAsync();
        var fresh = await AddPendingReferral(referrer.Id);

        var result = await _sut.ExecuteAsync(fresh, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.DailyCapReached);
        Context.Users.First(u => u.Id == referrer.Id).TrialBonusDays.ShouldBe(0);
        Context.Referrals.First(r => r.Id == fresh.Id).ActivatedAtUtc.ShouldBeNull();
    }

    [Test]
    public async Task ShouldReturnYearlyCapReached_WhenReferrerHitsYearlyActivationCap()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-1);
        referrer.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        for (var i = 0; i < TryActivateReferralService.YearlyActivationCap; i++)
        {
            var when = DateTime.UtcNow.AddDays(-14 * (i + 1));
            Context.Referrals.Add(new Referral
            {
                Id = Guid.NewGuid(),
                ReferrerUserId = referrer.Id,
                RefereeUserId = Guid.NewGuid(),
                CreatedAtUtc = when.AddHours(-3),
                ActivatedAtUtc = when,
                BonusReferrerDays = TryActivateReferralService.ReferrerTrialBonusDays,
                BonusRefereeDays = RecordReferralLinkService.RefereeTrialBonusDays
            });
        }
        await Context.SaveChangesAsync();
        var fresh = await AddPendingReferral(referrer.Id);

        var result = await _sut.ExecuteAsync(fresh, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.YearlyCapReached);
        Context.Referrals.First(r => r.Id == fresh.Id).ActivatedAtUtc.ShouldBeNull();
    }

    [Test]
    public async Task ShouldReturnReferrerGone_WhenReferrerWasDeleted()
    {
        var orphanReferrerId = Guid.NewGuid();
        var referral = await AddPendingReferral(orphanReferrerId);

        var result = await _sut.ExecuteAsync(referral, "first_lesson", CancellationToken.None);

        result.ShouldBe(TryActivateReferralResult.ReferrerGone);
    }

    [Test]
    public async Task ShouldRecordTriggerAndBonusDays_OnSuccessfulActivation()
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-3);
        await Context.SaveChangesAsync();
        var referral = await AddPendingReferral(referrer.Id);

        await _sut.ExecuteAsync(referral, "purchase", CancellationToken.None);

        var activated = Context.Referrals.First(r => r.Id == referral.Id);
        activated.ActivatedAtUtc.ShouldNotBeNull();
        activated.ActivationTrigger.ShouldBe("purchase");
        activated.BonusReferrerDays.ShouldBe(TryActivateReferralService.ReferrerTrialBonusDays);
    }
}
