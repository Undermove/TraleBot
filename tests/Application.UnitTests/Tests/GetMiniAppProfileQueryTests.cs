using Application.Common.Interfaces.MiniApp;
using Application.MiniApp.Queries;
using Application.UnitTests.Common;
using Domain.Entities;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// Verifies that the /api/miniapp/me payload reflects User-entity entitlement helpers.
/// Critical for subscription expiry: an ex-Pro user must report isPro=false and
/// not be granted access just because the stored IsPro flag is still true.
/// </summary>
public class GetMiniAppProfileQueryTests : CommandTestsBase
{
    private GetMiniAppProfile.Handler _sut = null!;

    [SetUp]
    public void SetUp()
    {
        var calc = new Mock<IProgressCalculator>();
        calc.Setup(c => c.SerializeProgress(It.IsAny<MiniAppUserProgress>())).Returns(new object());
        _sut = new GetMiniAppProfile.Handler(Context, calc.Object);
    }

    [Test]
    public async Task ShouldReportIsProTrue_AndAccess_ForActiveProUser()
    {
        var user = await CreateFreeUser();
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Month;
        user.SubscribedUntil = DateTime.UtcNow.AddDays(15);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.Authenticated.ShouldBeTrue();
        result.IsPro.ShouldBeTrue();
        result.IsTrialActive.ShouldBeFalse();
    }

    [Test]
    public async Task ShouldReportIsProFalse_WhenSubscriptionExpired()
    {
        // Subscription lapsed → user should NOT be reported as Pro any more.
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-60);
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Month;
        user.SubscribedUntil = DateTime.UtcNow.AddDays(-3);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.IsPro.ShouldBeFalse();
        result.IsTrialActive.ShouldBeFalse();
        result.TrialDaysLeft.ShouldBe(0);
    }

    [Test]
    public async Task ShouldReportTrialDaysLeft_ForNewlyRegisteredUser()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.IsPro.ShouldBeFalse();
        result.IsTrialActive.ShouldBeTrue();
        result.TrialDaysLeft.ShouldBe(30);
    }

    [Test]
    public async Task ShouldReportZeroTrialDays_WhenTrialAlreadyExpired()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-31);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.IsPro.ShouldBeFalse();
        result.IsTrialActive.ShouldBeFalse();
        result.TrialDaysLeft.ShouldBe(0);
    }

    [Test]
    public async Task ShouldReportIsProTrue_ForLifetimeUserWithNullSubscribedUntil()
    {
        var user = await CreateFreeUser();
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Lifetime;
        user.SubscribedUntil = null;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.IsPro.ShouldBeTrue();
        result.SubscriptionPlan.ShouldBe("Lifetime");
        result.SubscribedUntil.ShouldBeNull();
    }

    [Test]
    public async Task ShouldReflectTrialBonusDays_InTrialDaysLeft()
    {
        // Registered 20 days ago + 14 bonus days = 24 trial days left.
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-20);
        user.TrialBonusDays = 14;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.IsTrialActive.ShouldBeTrue();
        result.TrialDaysLeft.ShouldBe(24);
    }

    [Test]
    public async Task ShouldShowReferralExtensionCta_WhenTrialEndsSoon()
    {
        // ~2 days left → within the threshold.
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-User.TrialDays + 2);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.ShouldShowReferralExtensionCta.ShouldBeTrue();
    }

    [Test]
    public async Task ShouldNotShowReferralExtensionCta_WhenTrialFresh()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.ShouldShowReferralExtensionCta.ShouldBeFalse();
    }

    [Test]
    public async Task ShouldShowReferralExtensionCta_WhenTrialExpired()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-User.TrialDays - 5);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.ShouldShowReferralExtensionCta.ShouldBeTrue();
    }

    [Test]
    public async Task ShouldNotShowReferralExtensionCta_ForLifetimeUser()
    {
        var user = await CreateFreeUser();
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Lifetime;
        user.SubscribedUntil = null;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetMiniAppProfile { UserId = user.Id }, CancellationToken.None);

        result.ShouldShowReferralExtensionCta.ShouldBeFalse();
    }

    [Test]
    public async Task IsOwner_ShouldBeTrue_WhenOwnerTelegramIdMatchesUser()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 12345L;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(
            new GetMiniAppProfile { UserId = user.Id, OwnerTelegramId = 12345L },
            CancellationToken.None);

        result.IsOwner.ShouldBeTrue();
    }

    [Test]
    public async Task IsOwner_ShouldBeFalse_WhenOwnerTelegramIdIsZero()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 12345L;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(
            new GetMiniAppProfile { UserId = user.Id, OwnerTelegramId = 0 },
            CancellationToken.None);

        result.IsOwner.ShouldBeFalse();
    }

    [Test]
    public async Task IsOwner_ShouldBeFalse_WhenOwnerTelegramIdDoesNotMatchUser()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 12345L;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(
            new GetMiniAppProfile { UserId = user.Id, OwnerTelegramId = 99999L },
            CancellationToken.None);

        result.IsOwner.ShouldBeFalse();
    }
}
