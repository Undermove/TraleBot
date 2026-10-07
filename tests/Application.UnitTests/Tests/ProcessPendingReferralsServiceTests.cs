using Application.Common.Interfaces;
using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class ProcessPendingReferralsServiceTests : CommandTestsBase
{
    private Mock<IUserNotificationService> _notifications = null!;
    private ProcessPendingReferralsService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _notifications = new Mock<IUserNotificationService>();
        _sut = new ProcessPendingReferralsService(
            Context,
            new TryActivateReferralService(Context, NullLoggerFactory.Instance),
            _notifications.Object,
            NullLoggerFactory.Instance);
    }

    /// <summary>Referrer whose trial ended long ago + a friend who came two hours ago and added five words.</summary>
    private async Task<User> ReferrerWithActiveFriend(Action<User>? configure = null)
    {
        var referrer = await CreateFreeUser();
        referrer.RegisteredAtUtc = DateTime.UtcNow.AddDays(-200);
        referrer.TrialBonusDays = 0;
        configure?.Invoke(referrer);
        var friend = await CreateFreeUser();
        for (var i = 0; i < 5; i++)
        {
            Context.VocabularyEntries.Add(new VocabularyEntry
            {
                Id = Guid.NewGuid(), Word = $"слово {i}", Definition = $"word {i}", AdditionalInfo = "", Example = "",
                DateAddedUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow, UserId = friend.Id, Language = Language.Georgian
            });
        }
        Context.Referrals.Add(new Referral
        {
            Id = Guid.NewGuid(),
            ReferrerUserId = referrer.Id,
            RefereeUserId = friend.Id,
            CreatedAtUtc = DateTime.UtcNow.AddHours(-2),
            BonusRefereeDays = RecordReferralLinkService.RefereeTrialBonusDays
        });
        await Context.SaveChangesAsync();
        return referrer;
    }

    [Test]
    public async Task ShouldTellTheReferrerWhatTheyGotAndUntilWhen()
    {
        var referrer = await ReferrerWithActiveFriend();

        var activated = await _sut.ExecuteAsync(CancellationToken.None);

        activated.ShouldBe(1);
        var until = Context.Users.First(u => u.Id == referrer.Id).BonusAccessUntilUtc!.Value;
        _notifications.Verify(n => n.SendReferralBonusGrantedAsync(
            It.Is<User>(u => u.Id == referrer.Id), ReferralBonusKind.FreeWeek, 7, until, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ShouldKeepTheBonus_WhenTelegramFails()
    {
        var referrer = await ReferrerWithActiveFriend();
        _notifications
            .Setup(n => n.SendReferralBonusGrantedAsync(
                It.IsAny<User>(), It.IsAny<ReferralBonusKind>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("telegram is down"));

        var activated = await _sut.ExecuteAsync(CancellationToken.None);

        activated.ShouldBe(1);
        var updated = Context.Users.First(u => u.Id == referrer.Id);
        updated.HasMiniAppAccess().ShouldBeTrue();
        Context.Referrals.Single(r => r.ReferrerUserId == referrer.Id).ActivatedAtUtc.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldNotNotifyTwice_WhenRunAgain()
    {
        await ReferrerWithActiveFriend();

        await _sut.ExecuteAsync(CancellationToken.None);
        await _sut.ExecuteAsync(CancellationToken.None);

        _notifications.Verify(n => n.SendReferralBonusGrantedAsync(
            It.IsAny<User>(), It.IsAny<ReferralBonusKind>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ShouldNotWriteToSomeoneWhoBlockedTheBot_ButStillGiveTheBonus()
    {
        var referrer = await ReferrerWithActiveFriend(u => u.IsActive = false);

        await _sut.ExecuteAsync(CancellationToken.None);

        Context.Users.First(u => u.Id == referrer.Id).HasMiniAppAccess().ShouldBeTrue();
        _notifications.VerifyNoOtherCalls();
    }

    [Test]
    public async Task ShouldSayNothingToLifetime()
    {
        await ReferrerWithActiveFriend(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        (await _sut.ExecuteAsync(CancellationToken.None)).ShouldBe(1);

        _notifications.VerifyNoOtherCalls();
    }
}
