using Application.Admin;
using Application.MiniApp.Services;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class SendLaunchAnnouncementServiceTests : CommandTestsBase
{
    private Mock<ITelegramMessageSender> _senderMock = null!;
    private SendLaunchAnnouncementService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _senderMock = new Mock<ITelegramMessageSender>();
        _senderMock
            .Setup(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _sut = new SendLaunchAnnouncementService(Context, _senderMock.Object, NullLoggerFactory.Instance);
    }

    [Test]
    public async Task ShouldSendAnnouncement_ToGeorgianUserWithoutPriorAnnouncement()
    {
        var user = await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());

        var result = await _sut.ExecuteAsync(CancellationToken.None);

        result.Sent.ShouldBe(1);
        result.Total.ShouldBe(1);
        _senderMock.Verify(
            s => s.SendTextAsync(user.TelegramId, It.IsAny<string>(), true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task ShouldNotSendAnnouncement_ToUserAlreadyMarked()
    {
        await SaveUser(() =>
        {
            var u = Create.User().WithCurrentLanguage(Language.Georgian).Build();
            u.MiniAppAnnounceSentAtUtc = DateTime.UtcNow.AddHours(-1);
            return u;
        });

        var result = await _sut.ExecuteAsync(CancellationToken.None);

        result.Total.ShouldBe(0);
        result.Sent.ShouldBe(0);
        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task ShouldNotSendAnnouncement_ToNonGeorgianUser()
    {
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.English).Build());

        var result = await _sut.ExecuteAsync(CancellationToken.None);

        result.Total.ShouldBe(0);
        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task ShouldMarkUserAsSent_BeforeSending_SoRestartIsIdempotent()
    {
        var user = await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());

        await _sut.ExecuteAsync(CancellationToken.None);

        // Reload from DB to verify the timestamp was persisted
        var reloaded = await Context.Users.FindAsync(user.Id);
        reloaded!.MiniAppAnnounceSentAtUtc.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldNotSendDuplicate_WhenRunTwice()
    {
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());

        await _sut.ExecuteAsync(CancellationToken.None);
        // Create a fresh service instance so it re-queries the DB
        var sut2 = new SendLaunchAnnouncementService(Context, _senderMock.Object, NullLoggerFactory.Instance);
        await sut2.ExecuteAsync(CancellationToken.None);

        // SendTextAsync called exactly once across both runs
        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task ShouldSendToAllEligibleGeorgianUsers()
    {
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.English).Build());

        var result = await _sut.ExecuteAsync(CancellationToken.None);

        result.Total.ShouldBe(2);
        result.Sent.ShouldBe(2);
        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), true, It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Test]
    public async Task ShouldCountFailures_WhenSendFails()
    {
        await SaveUser(() => Create.User().WithCurrentLanguage(Language.Georgian).Build());
        _senderMock
            .Setup(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.ExecuteAsync(CancellationToken.None);

        result.Total.ShouldBe(1);
        result.Sent.ShouldBe(0);
        result.Failed.ShouldBe(1);
    }
}
