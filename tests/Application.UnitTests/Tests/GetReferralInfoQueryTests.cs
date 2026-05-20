using Application.MiniApp.Commands;
using Application.MiniApp.Queries;
using Application.UnitTests.Common;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class GetReferralInfoQueryTests : CommandTestsBase
{
    private GetReferralInfoQuery _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new GetReferralInfoQuery(Context);
    }

    private async Task<User> AddUser(bool isPro = false, bool isLifetime = false)
    {
        var settingsId = Guid.NewGuid();
        var user = new User
        {
            Id = Guid.NewGuid(),
            TelegramId = Random.Shared.NextInt64(100_000, 999_999),
            IsPro = isPro || isLifetime,
            SubscriptionPlan = isLifetime ? SubscriptionPlan.Lifetime
                : isPro ? SubscriptionPlan.Month
                : null,
            SubscribedUntil = isPro && !isLifetime ? DateTime.UtcNow.AddDays(30) : null,
            RegisteredAtUtc = DateTime.UtcNow,
            IsActive = true,
            InitialLanguageSet = false,
            UserSettingsId = settingsId
        };
        user.Settings = new UserSettings { Id = settingsId, UserId = user.Id, CurrentLanguage = Language.English };
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    private async Task AddReferral(Guid referrerId, DateTime? activatedAt)
    {
        Context.Referrals.Add(new Referral
        {
            Id = Guid.NewGuid(),
            ReferrerUserId = referrerId,
            RefereeUserId = Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow.AddDays(-1),
            ActivatedAtUtc = activatedAt,
            BonusReferrerDays = 0,
            BonusRefereeDays = 0
        });
        await Context.SaveChangesAsync();
    }

    [Test]
    public async Task ReturnsNull_WhenUserDoesNotExist()
    {
        var result = await _sut.ExecuteAsync(Guid.NewGuid(), CancellationToken.None);
        result.ShouldBeNull();
    }

    [Test]
    public async Task InvitedCount_IncludesNonActivatedReferrals()
    {
        var user = await AddUser();
        await AddReferral(user.Id, activatedAt: null);
        await AddReferral(user.Id, activatedAt: null);
        await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-10));

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.InvitedCount.ShouldBe(3);
        result.ActivatedCount.ShouldBe(1);
    }

    [Test]
    public async Task ActivatedCount_ExcludesReferralsWithNullActivation()
    {
        var user = await AddUser();
        await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-5));
        await AddReferral(user.Id, activatedAt: null);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.ActivatedCount.ShouldBe(1);
        result.InvitedCount.ShouldBe(2);
    }

    [Test]
    public async Task CapReached_WhenYearActivatedReachesYearlyCap()
    {
        var user = await AddUser(isPro: true);
        for (var i = 0; i < TryActivateReferralService.YearlyActivationCap; i++)
            await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-i - 1));

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.CapReached.ShouldBeTrue();
    }

    [Test]
    public async Task CapReached_IsFalse_WhenBelowYearlyCap()
    {
        var user = await AddUser(isPro: true);
        for (var i = 0; i < TryActivateReferralService.YearlyActivationCap - 1; i++)
            await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-i - 1));

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.CapReached.ShouldBeFalse();
    }

    [Test]
    public async Task CapReached_IsFalse_ForLifetimeUser_EvenWhenYearlyCapExceeded()
    {
        var user = await AddUser(isLifetime: true);
        for (var i = 0; i <= TryActivateReferralService.YearlyActivationCap; i++)
            await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-i - 1));

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.CapReached.ShouldBeFalse();
    }

    [Test]
    public async Task YearActivated_ExcludesActivationsOlderThanOneYear()
    {
        var user = await AddUser(isPro: true);
        await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-10));   // within year
        await AddReferral(user.Id, activatedAt: DateTime.UtcNow.AddDays(-400));  // older than year
        await AddReferral(user.Id, activatedAt: null);                            // not activated

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        // Only 1 activation counts toward yearActivated; cap=6, so not reached.
        result!.CapReached.ShouldBeFalse();
        result.ActivatedCount.ShouldBe(2);
        result.InvitedCount.ShouldBe(3);
    }

    [Test]
    public async Task BonusShortLabel_IsProBonus_ForProNonLifetimeUser()
    {
        var user = await AddUser(isPro: true);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.BonusShortLabel.ShouldBe($"+{TryActivateReferralService.ReferrerProBonusDays} дней Pro");
    }

    [Test]
    public async Task BonusShortLabel_IsTrialBonus_ForFreeUser()
    {
        var user = await AddUser(isPro: false);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.BonusShortLabel.ShouldBe($"+{TryActivateReferralService.ReferrerTrialBonusDays} дней триала");
    }

    [Test]
    public async Task BonusShortLabel_IsEmpty_ForLifetimeUser()
    {
        var user = await AddUser(isLifetime: true);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.BonusShortLabel.ShouldBeEmpty();
    }

    [Test]
    public async Task Rules_ContainsLifetimeNote_ForLifetimeUser()
    {
        var user = await AddUser(isLifetime: true);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.Rules.ShouldContain(r => r.Contains("Lifetime"));
    }

    [Test]
    public async Task Rules_ContainsCapLimits_ForNonLifetimeUser()
    {
        var user = await AddUser(isPro: true);

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.Rules.ShouldContain(r => r.Contains(TryActivateReferralService.DailyActivationCap.ToString()));
        result.Rules.ShouldContain(r => r.Contains(TryActivateReferralService.YearlyActivationCap.ToString()));
    }

    [Test]
    public async Task Rules_InviteeTotalTrialDays_MatchesExpectedFormula()
    {
        var user = await AddUser();
        var expectedTotal = User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays;

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.Rules.ShouldContain(r => r.Contains(expectedTotal.ToString()));
    }

    [Test]
    public async Task ReferrerTelegramId_MatchesUser()
    {
        var user = await AddUser();

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.ReferrerTelegramId.ShouldBe(user.TelegramId);
    }

    [Test]
    public async Task ZeroReferrals_AllCountsAreZero()
    {
        var user = await AddUser();

        var result = await _sut.ExecuteAsync(user.Id, CancellationToken.None);

        result!.InvitedCount.ShouldBe(0);
        result.ActivatedCount.ShouldBe(0);
        result.CapReached.ShouldBeFalse();
    }
}
