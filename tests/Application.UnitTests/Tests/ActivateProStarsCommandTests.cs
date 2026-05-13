using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Application.UnitTests.Tests;

public class ActivateProStarsCommandTests : CommandTestsBase
{
    private ActivateProStars.Handler _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new ActivateProStars.Handler(Context, NullLoggerFactory.Instance);
    }

    [Test]
    public async Task ShouldReturnSuccess_AndSetIsPro_WhenUserExistsAndIsNotPro()
    {
        var user = await CreateFreeUser();

        var result = await _sut.Handle(new ActivateProStars { UserId = user.Id }, CancellationToken.None);

        result.ShouldBe(ActivateProStarsResult.Success);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.IsPro.ShouldBeTrue();
        updated.ProPurchasedAtUtc.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldSetProPurchasedAtUtc_ToApproximatelyNow()
    {
        var before = DateTime.UtcNow;
        var user = await CreateFreeUser();

        await _sut.Handle(new ActivateProStars { UserId = user.Id }, CancellationToken.None);

        var after = DateTime.UtcNow;
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.ProPurchasedAtUtc.ShouldNotBeNull();
        updated.ProPurchasedAtUtc!.Value.ShouldBeGreaterThanOrEqualTo(before);
        updated.ProPurchasedAtUtc!.Value.ShouldBeLessThanOrEqualTo(after);
    }

    [Test]
    public async Task ShouldReturnAlreadyPro_WhenUserAlreadyHasPro()
    {
        var user = await CreateFreeUser();
        user.IsPro = true;
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new ActivateProStars { UserId = user.Id }, CancellationToken.None);

        result.ShouldBe(ActivateProStarsResult.AlreadyPro);
    }

    [Test]
    public async Task ShouldNotChangeProPurchasedAtUtc_WhenAlreadyPro()
    {
        var originalDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var user = await CreateFreeUser();
        user.IsPro = true;
        user.ProPurchasedAtUtc = originalDate;
        await Context.SaveChangesAsync();

        await _sut.Handle(new ActivateProStars { UserId = user.Id }, CancellationToken.None);

        var unchanged = Context.Users.First(u => u.Id == user.Id);
        unchanged.ProPurchasedAtUtc.ShouldBe(originalDate);
    }

    [Test]
    public async Task ShouldStackPlanOnRemainingTrial_WhenUserPurchasesDuringTrial()
    {
        var user = await CreateFreeUser();
        var registeredAt = DateTime.UtcNow.AddDays(-5);
        user.RegisteredAtUtc = registeredAt;
        await Context.SaveChangesAsync();

        await _sut.Handle(
            new ActivateProStars { UserId = user.Id, Payload = "Stars_Pro_Month" },
            CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.SubscribedUntil.ShouldBe(registeredAt.AddDays(User.TrialDays).AddDays(30));
    }

    [Test]
    public async Task ShouldNotStackTrial_WhenTrialAlreadyExpired()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-User.TrialDays - 10);
        await Context.SaveChangesAsync();

        var before = DateTime.UtcNow;
        await _sut.Handle(
            new ActivateProStars { UserId = user.Id, Payload = "Stars_Pro_Month" },
            CancellationToken.None);
        var after = DateTime.UtcNow;

        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.SubscribedUntil.ShouldNotBeNull();
        updated.SubscribedUntil!.Value.ShouldBeInRange(before.AddDays(30), after.AddDays(30));
    }

    [Test]
    public async Task ShouldReturnUserNotFound_WhenUserDoesNotExist()
    {
        var result = await _sut.Handle(
            new ActivateProStars { UserId = Guid.NewGuid() },
            CancellationToken.None);

        result.ShouldBe(ActivateProStarsResult.UserNotFound);
    }
}
