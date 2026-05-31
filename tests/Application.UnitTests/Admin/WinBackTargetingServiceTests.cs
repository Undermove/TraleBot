using Application.Admin;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Admin;

public class WinBackTargetingServiceTests : CommandTestsBase
{
    private WinBackTargetingService _sut = null!;

    private readonly DateTime _cohortAfter = DateTime.UtcNow.AddDays(-365);
    private readonly DateTime _cohortBefore = DateTime.UtcNow.AddDays(1);
    private const int InactiveSinceDays = 7;

    [SetUp]
    public void SetUp()
    {
        _sut = new WinBackTargetingService(Context);
    }

    [Test]
    public async Task GetEligibleUsers_DormantUserWithNullWinBackSent_IsIncluded()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-8),
            Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = DateTime.UtcNow.AddDays(-8),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-8)
        });
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldHaveSingleItem();
        result[0].UserId.ShouldBe(user.Id);
    }

    [Test]
    public async Task GetEligibleUsers_ActiveUser_IsExcluded()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-1),
            Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = DateTime.UtcNow.AddDays(-1),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-1)
        });
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldBeEmpty();
    }

    [Test]
    public async Task GetEligibleUsers_InactiveUser_IsExcluded()
    {
        var user = Create.User().Build();
        user.IsActive = false;
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldBeEmpty();
    }

    [Test]
    public async Task GetEligibleUsers_AlreadySentUser_IsExcluded()
    {
        var user = Create.User().Build();
        user.SetWinBackSent(DateTime.UtcNow.AddDays(-30));
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldBeEmpty();
    }

    [Test]
    public async Task GetEligibleUsers_UserWithNoActivityRecords_IsIncluded()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldHaveSingleItem();
        result[0].UserId.ShouldBe(user.Id);
    }

    [Test]
    public async Task GetEligibleUsers_UserOutsideCohortWindow_IsExcluded()
    {
        var user = Create.User().Build();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-400);
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        // cohortAfter = 365 days ago, user registered 400 days ago → outside window
        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldBeEmpty();
    }

    [Test]
    public async Task GetEligibleUsers_UserInactiveExactlyNDays_IsIncluded()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        // Last activity exactly InactiveSinceDays days ago — should still qualify as dormant
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LastPlayedAtUtc = DateTime.UtcNow.AddDays(-InactiveSinceDays),
            Xp = 0, Streak = 0, Hearts = 0, MaxHearts = 0,
            CompletedLessonsJson = "{}",
            CreatedAtUtc = DateTime.UtcNow.AddDays(-InactiveSinceDays),
            UpdatedAtUtc = DateTime.UtcNow.AddDays(-InactiveSinceDays)
        });
        await Context.SaveChangesAsync();

        var result = await _sut.GetEligibleUsersAsync(_cohortAfter, _cohortBefore, InactiveSinceDays, CancellationToken.None);

        result.ShouldHaveSingleItem();
    }
}
