using Application.Admin;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Moq;
using Shouldly;

namespace Application.UnitTests.Admin;

public class WinBackBroadcastServiceTests : CommandTestsBase
{
    private Mock<ITelegramMessageSender> _senderMock = null!;
    private WinBackBroadcastService _sut = null!;

    private const long TestTelegramId = 100500;

    [SetUp]
    public void SetUp()
    {
        _senderMock = new Mock<ITelegramMessageSender>();
        _senderMock
            .Setup(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var targeting = new WinBackTargetingService(Context);
        _sut = new WinBackBroadcastService(targeting, _senderMock.Object, Context);
    }

    private async Task<User> SeedEligibleCohortUser()
    {
        var user = Create.User().Build();
        user.RegisteredAtUtc = new DateTime(2026, 5, 13, 12, 0, 0, DateTimeKind.Utc);
        user.TelegramId = TestTelegramId;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    [Test]
    public async Task ExecuteAsync_MessageTextContainsGeorgianPhraseAndTranslation()
    {
        var user = await SeedEligibleCohortUser();

        string? capturedText = null;
        _senderMock
            .Setup(s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .Callback<long, string, bool, CancellationToken>((_, text, _, _) => capturedText = text)
            .ReturnsAsync(true);

        await _sut.ExecuteAsync(dryRun: false, CancellationToken.None);

        capturedText.ShouldNotBeNull();
        capturedText.ShouldContain("მოგვენატრე");
        capturedText.ShouldContain("нам тебя не хватало");
    }

    [Test]
    public async Task ExecuteAsync_DryRun_DoesNotCallSender()
    {
        await SeedEligibleCohortUser();

        await _sut.ExecuteAsync(dryRun: true, CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task ExecuteAsync_DryRun_DoesNotSetWinBackSentAtUtc()
    {
        var user = await SeedEligibleCohortUser();

        await _sut.ExecuteAsync(dryRun: true, CancellationToken.None);

        var reloaded = await Context.Users.FindAsync(user.Id);
        reloaded!.WinBackSentAtUtc.ShouldBeNull();
    }

    [Test]
    public async Task ExecuteAsync_DryRun_ReturnsSentCountEqualToCandidates()
    {
        await SeedEligibleCohortUser();

        var result = await _sut.ExecuteAsync(dryRun: true, CancellationToken.None);

        result.Sent.ShouldBeGreaterThan(0);
    }

    [Test]
    public async Task ExecuteAsync_NonDryRun_SetsWinBackSentAtUtc_OnSuccess()
    {
        var user = await SeedEligibleCohortUser();

        await _sut.ExecuteAsync(dryRun: false, CancellationToken.None);

        var reloaded = await Context.Users.FindAsync(user.Id);
        reloaded!.WinBackSentAtUtc.ShouldNotBeNull();
    }

    [Test]
    public async Task ExecuteAsync_NonDryRun_IncludesMiniAppButton()
    {
        await SeedEligibleCohortUser();

        await _sut.ExecuteAsync(dryRun: false, CancellationToken.None);

        _senderMock.Verify(
            s => s.SendTextAsync(It.IsAny<long>(), It.IsAny<string>(), true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task ExecuteAsync_NonDryRun_ReturnsZeroSent_WhenNoCandidates()
    {
        // No cohort users seeded — empty DB
        var result = await _sut.ExecuteAsync(dryRun: false, CancellationToken.None);

        result.Sent.ShouldBe(0);
        result.Failed.ShouldBe(0);
    }
}
