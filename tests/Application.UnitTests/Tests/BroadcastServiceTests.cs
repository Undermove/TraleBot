using Application.Admin;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class BroadcastServiceTests : CommandTestsBase
{
    private Mock<ITelegramMessageSender> _senderMock = null!;
    private BroadcastService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _senderMock = new Mock<ITelegramMessageSender>();
        _senderMock
            .Setup(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _sut = new BroadcastService(Context, _senderMock.Object, NullLoggerFactory.Instance);
    }

    // ---- Lifetime downgrade guard ----

    [Test]
    public async Task Execute_LifetimeUser_MonthGrant_DoesNotDowngradePlan()
    {
        var user = Create.User().WithLifetime().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var segment = new BroadcastSegment { ProStatus = BroadcastProFilter.Any };
        var result = await _sut.ExecuteAsync(segment, "hello", "Month", dryRun: false, includeMiniAppButton: false, CancellationToken.None);

        result.Granted.ShouldBe(0);
        result.Sent.ShouldBe(1);

        var saved = Context.Users.Single(u => u.Id == user.Id);
        saved.SubscriptionPlan.ShouldBe(SubscriptionPlan.Lifetime);
        saved.SubscribedUntil.ShouldBeNull();
    }

    [Test]
    public async Task Execute_LifetimeUser_LifetimeGrant_IsNotBlockedByGuard()
    {
        var user = Create.User().WithLifetime().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var segment = new BroadcastSegment { ProStatus = BroadcastProFilter.Any };
        var result = await _sut.ExecuteAsync(segment, "hello", "Lifetime", dryRun: false, includeMiniAppButton: false, CancellationToken.None);

        // Lifetime → Lifetime is not a downgrade — grant is applied (granted=1).
        result.Granted.ShouldBe(1);
        result.Sent.ShouldBe(1);
    }

    // ---- Plan stacking ----

    [Test]
    public async Task Execute_ExpiredProUser_MonthGrant_StacksFromNow()
    {
        var pastExpiry = DateTime.UtcNow.AddDays(-5);
        var user = Create.User().WithPremiumAccountType().Build();
        user.SubscribedUntil = pastExpiry;
        user.IsPro = true;
        user.SubscriptionPlan = SubscriptionPlan.Month;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var before = DateTime.UtcNow;
        var segment = new BroadcastSegment { ProStatus = BroadcastProFilter.Any };
        await _sut.ExecuteAsync(segment, "hello", "Month", dryRun: false, includeMiniAppButton: false, CancellationToken.None);
        var after = DateTime.UtcNow;

        var saved = Context.Users.Single(u => u.Id == user.Id);
        saved.SubscribedUntil.ShouldNotBeNull();
        // Expired: new expiry should be approximately now+30 days.
        saved.SubscribedUntil!.Value.ShouldBeGreaterThan(before.AddDays(29));
        saved.SubscribedUntil!.Value.ShouldBeLessThan(after.AddDays(31));
    }

    [Test]
    public async Task Execute_ActiveProUser_MonthGrant_StacksOnTopOfExistingExpiry()
    {
        var futureExpiry = DateTime.UtcNow.AddDays(20);
        var user = Create.User().WithPremiumAccountType().Build();
        user.SubscribedUntil = futureExpiry;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var segment = new BroadcastSegment { ProStatus = BroadcastProFilter.Any };
        await _sut.ExecuteAsync(segment, "hello", "Month", dryRun: false, includeMiniAppButton: false, CancellationToken.None);

        var saved = Context.Users.Single(u => u.Id == user.Id);
        // Should stack 30 days on top of the existing futureExpiry.
        saved.SubscribedUntil!.Value.ShouldBeGreaterThan(futureExpiry.AddDays(29));
    }

    // ---- Dry run ----

    [Test]
    public async Task Execute_DryRun_SendsNothingAndGrantsNothing()
    {
        var user = Create.User().WithPremiumAccountType().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var segment = new BroadcastSegment { ProStatus = BroadcastProFilter.Any };
        var result = await _sut.ExecuteAsync(segment, "hello", "Month", dryRun: true, includeMiniAppButton: false, CancellationToken.None);

        result.Sent.ShouldBe(0);
        result.Granted.ShouldBe(0);
        _senderMock.Verify(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
