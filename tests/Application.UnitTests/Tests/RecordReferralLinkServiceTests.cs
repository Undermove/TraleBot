using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Application.UnitTests.Tests;

public class RecordReferralLinkServiceTests : CommandTestsBase
{
    private RecordReferralLinkService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new RecordReferralLinkService(Context, NullLoggerFactory.Instance);
    }

    [Test]
    public async Task ShouldGiveReferee60DaysOfTrial_WhenLinkRecorded()
    {
        var referrer = await CreateFreeUser();
        var newUser = await CreateFreeUser();
        var registeredAt = DateTime.UtcNow;
        newUser.RegisteredAtUtc = registeredAt;
        newUser.TrialBonusDays = 0;
        referrer.TelegramId = 555;
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(newUser.Id, 555, CancellationToken.None);

        result.ShouldBe(RecordReferralLinkResult.Recorded);
        var updated = Context.Users.First(u => u.Id == newUser.Id);
        // Bonus accumulates into TrialBonusDays; registration date is untouched.
        updated.RegisteredAtUtc.ShouldBe(registeredAt);
        updated.TrialBonusDays.ShouldBe(RecordReferralLinkService.RefereeTrialBonusDays);
        updated.TrialEndsAtUtc.ShouldBe(registeredAt.AddDays(User.TrialDays + RecordReferralLinkService.RefereeTrialBonusDays));
    }

    [Test]
    public async Task ShouldCreateReferralRow_WithCorrectBonusFields()
    {
        var referrer = await CreateFreeUser();
        var newUser = await CreateFreeUser();
        referrer.TelegramId = 777;
        await Context.SaveChangesAsync();

        await _sut.ExecuteAsync(newUser.Id, 777, CancellationToken.None);

        var row = Context.Referrals.Single();
        row.ReferrerUserId.ShouldBe(referrer.Id);
        row.RefereeUserId.ShouldBe(newUser.Id);
        row.ActivatedAtUtc.ShouldBeNull();
        row.BonusRefereeDays.ShouldBe(RecordReferralLinkService.RefereeTrialBonusDays);
        row.BonusReferrerDays.ShouldBe(0);
    }

    [Test]
    public async Task ShouldRejectSelfReferral()
    {
        var user = await CreateFreeUser();
        user.TelegramId = 999;
        user.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(user.Id, 999, CancellationToken.None);

        result.ShouldBe(RecordReferralLinkResult.SelfReferral);
        Context.Users.First(u => u.Id == user.Id).TrialBonusDays.ShouldBe(0);
        Context.Referrals.Count().ShouldBe(0);
    }

    [Test]
    public async Task ShouldRejectDuplicateReferralForSameReferee()
    {
        var firstReferrer = await CreateFreeUser();
        var secondReferrer = await CreateFreeUser();
        var newUser = await CreateFreeUser();
        firstReferrer.TelegramId = 111;
        secondReferrer.TelegramId = 222;
        newUser.TrialBonusDays = 0;
        await Context.SaveChangesAsync();

        await _sut.ExecuteAsync(newUser.Id, 111, CancellationToken.None);
        var bonusAfterFirst = Context.Users.First(u => u.Id == newUser.Id).TrialBonusDays;

        var second = await _sut.ExecuteAsync(newUser.Id, 222, CancellationToken.None);

        second.ShouldBe(RecordReferralLinkResult.AlreadyReferred);
        // No second bonus applied.
        Context.Users.First(u => u.Id == newUser.Id).TrialBonusDays.ShouldBe(bonusAfterFirst);
        Context.Referrals.Count().ShouldBe(1);
    }

    [Test]
    public async Task ShouldReturnReferrerNotFound_WhenReferrerTelegramIdUnknown()
    {
        var newUser = await CreateFreeUser();

        var result = await _sut.ExecuteAsync(newUser.Id, 424242, CancellationToken.None);

        result.ShouldBe(RecordReferralLinkResult.ReferrerNotFound);
        Context.Referrals.Count().ShouldBe(0);
    }
}
