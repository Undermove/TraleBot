using Application.MiniApp.Services;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class FeedTreatServiceTests : CommandTestsBase
{
    private FeedTreatService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new FeedTreatService(Context);
    }

    [Test]
    public async Task ShouldReturnSuccess_WhenUserHasEnoughXp()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 50);

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None);

        response.Result.ShouldBe(FeedTreatResult.Success);
    }

    [Test]
    public async Task ShouldDeductXpSpent_OnSuccessfulPurchase()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 50);

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // ძვალი — 10 xp

        response.XpSpent.ShouldBe(10);
    }

    [Test]
    public async Task ShouldIncrementTotalTreatsGiven_OnSuccessfulPurchase()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 50);

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None);

        response.TotalTreatsGiven.ShouldBe(1);
    }

    [Test]
    public async Task ShouldReturnNotEnoughXp_WhenAvailableXpIsLessThanPrice()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 5); // only 5 xp, need 10 for ძვალი

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None);

        response.Result.ShouldBe(FeedTreatResult.NotEnoughXp);
    }

    [Test]
    public async Task ShouldReturnInvalidTreatIndex_ForNegativeIndex()
    {
        var user = await CreateFreeUser();

        var response = await _sut.ExecuteAsync(user.Id, -1, CancellationToken.None);

        response.Result.ShouldBe(FeedTreatResult.InvalidTreatIndex);
    }

    [Test]
    public async Task ShouldReturnInvalidTreatIndex_ForIndexOutOfRange()
    {
        var user = await CreateFreeUser();

        var response = await _sut.ExecuteAsync(user.Id, 5, CancellationToken.None);

        response.Result.ShouldBe(FeedTreatResult.InvalidTreatIndex);
    }

    [Test]
    public async Task ShouldReturnUserNotFound_WhenUserDoesNotExist()
    {
        var response = await _sut.ExecuteAsync(Guid.NewGuid(), 0, CancellationToken.None);

        response.Result.ShouldBe(FeedTreatResult.UserNotFound);
    }

    [Test]
    public async Task ShouldAccumulateXpSpent_AcrossMultiplePurchases()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 100);

        await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // 10 xp
        await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // 10 xp
        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // 10 xp

        response.XpSpent.ShouldBe(30);
        response.TotalTreatsGiven.ShouldBe(3);
    }

    [Test]
    public async Task ShouldReturnNotEnoughXp_WhenPriorPurchasesConsumedAvailableXp()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 15); // 15 total
        await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // spend 10, 5 available

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None); // need 10, only 5 available

        response.Result.ShouldBe(FeedTreatResult.NotEnoughXp);
    }

    [Test]
    public async Task ShouldChargeExactPriceForEachTreatTier()
    {
        int[] expectedPrices = [10, 30, 60, 100, 200];

        for (int i = 0; i < expectedPrices.Length; i++)
        {
            var user = await CreateFreeUser();
            await GiveUserXp(user.Id, expectedPrices[i]);

            var response = await _sut.ExecuteAsync(user.Id, i, CancellationToken.None);

            response.Result.ShouldBe(FeedTreatResult.Success,
                $"treat index {i} should succeed with exactly {expectedPrices[i]} xp");
            response.XpSpent.ShouldBe(expectedPrices[i],
                $"treat index {i} should deduct exactly {expectedPrices[i]} xp");
        }
    }

    [Test]
    public async Task ShouldNotModifyProgress_WhenNotEnoughXp()
    {
        var user = await CreateFreeUser();
        await GiveUserXp(user.Id, 5);

        var response = await _sut.ExecuteAsync(user.Id, 0, CancellationToken.None);

        response.XpSpent.ShouldBe(0);
        response.TotalTreatsGiven.ShouldBe(0);
    }

    private async Task GiveUserXp(Guid userId, int xp)
    {
        var now = DateTime.UtcNow;
        var progress = new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Xp = xp,
            Streak = 0,
            Hearts = 0,
            MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        Context.MiniAppUserProgresses.Add(progress);
        await Context.SaveChangesAsync();
    }
}
