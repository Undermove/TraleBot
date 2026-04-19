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
    public async Task ShouldRecordReferral_WhenNewUserComesViaValidReferralLink()
    {
        // Arrange
        var referrer = await SaveUserWithTelegramId(11111L);
        var referee = await CreateFreeUser();

        // Act
        var result = await _sut.ExecuteAsync(referee.Id, referrer.TelegramId, CancellationToken.None);

        // Assert
        result.ShouldBe(RecordReferralLinkResult.Recorded);
        Context.Referrals.Any(r => r.RefereeUserId == referee.Id && r.ReferrerUserId == referrer.Id)
            .ShouldBeTrue();
    }

    [Test]
    public async Task ShouldExtendRefereeTrial_WhenReferralRecorded()
    {
        // Arrange
        var referrer = await SaveUserWithTelegramId(22222L);
        var referee = await CreateFreeUser();
        var registeredAt = referee.RegisteredAtUtc;

        // Act
        await _sut.ExecuteAsync(referee.Id, referrer.TelegramId, CancellationToken.None);

        // Assert — referee's trial is extended by shifting RegisteredAtUtc backward
        var updatedReferee = Context.Users.Single(u => u.Id == referee.Id);
        updatedReferee.RegisteredAtUtc.ShouldBeLessThan(registeredAt);
    }

    [Test]
    public async Task ShouldReturnSelfReferral_WhenUserTriesToReferThemselves()
    {
        // Arrange
        var user = await SaveUserWithTelegramId(33333L);

        // Act
        var result = await _sut.ExecuteAsync(user.Id, user.TelegramId, CancellationToken.None);

        // Assert
        result.ShouldBe(RecordReferralLinkResult.SelfReferral);
        Context.Referrals.Any().ShouldBeFalse();
    }

    [Test]
    public async Task ShouldReturnAlreadyReferred_WhenRefereeAlreadyHasReferral()
    {
        // Arrange
        var referrer1 = await SaveUserWithTelegramId(44444L);
        var referrer2 = await SaveUserWithTelegramId(55555L);
        var referee = await CreateFreeUser();

        // First referral
        await _sut.ExecuteAsync(referee.Id, referrer1.TelegramId, CancellationToken.None);

        // Act — second referral attempt
        var result = await _sut.ExecuteAsync(referee.Id, referrer2.TelegramId, CancellationToken.None);

        // Assert
        result.ShouldBe(RecordReferralLinkResult.AlreadyReferred);
        Context.Referrals.Count(r => r.RefereeUserId == referee.Id).ShouldBe(1);
    }

    [Test]
    public async Task ShouldReturnReferrerNotFound_WhenReferrerTelegramIdDoesNotExist()
    {
        // Arrange
        var referee = await CreateFreeUser();

        // Act
        var result = await _sut.ExecuteAsync(referee.Id, 9999999L, CancellationToken.None);

        // Assert
        result.ShouldBe(RecordReferralLinkResult.ReferrerNotFound);
    }

    private async Task<User> SaveUserWithTelegramId(long telegramId)
    {
        var userId = Guid.NewGuid();
        var settingsId = Guid.NewGuid();
        var userWithId = new User
        {
            Id = userId,
            TelegramId = telegramId,
            AccountType = UserAccountType.Free,
            InitialLanguageSet = true,
            RegisteredAtUtc = DateTime.UtcNow,
            UserSettingsId = settingsId,
            Settings = new UserSettings
            {
                Id = settingsId,
                UserId = userId,
                CurrentLanguage = Language.English
            }
        };
        Context.Users.Add(userWithId);
        await Context.SaveChangesAsync();
        return userWithId;
    }
}
