using Application.Achievements.Services;
using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces;
using Application.Common.Interfaces.Achievements;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// An achievement is saved first and announced second. When Telegram refuses the announcement (the
/// user blocked the bot, the API is down) the action that earned it — a translation — must still succeed.
/// </summary>
public class AchievementsNotificationFailureTests : CommandTestsBase
{
    private sealed class AlwaysEarned : IAchievementChecker<IAchievementTrigger>
    {
        public string Icon => "*";
        public string Name => "Test";
        public string Description => "Test";
        public Guid AchievementTypeId { get; } = Guid.NewGuid();
        public bool CheckAchievement(object trigger) => true;
    }

    [Test]
    public async Task Failed_notification_does_not_fail_the_action_and_the_achievement_stays()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        var notifications = new Mock<IUserNotificationService>();
        notifications
            .Setup(n => n.NotifyAboutUnlockedAchievementAsync(It.IsAny<Achievement>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Telegram is unreachable"));
        var service = new AchievementsService(Context, [new AlwaysEarned()], notifications.Object);

        await Should.NotThrowAsync(() =>
            service.AssignAchievements(new VocabularyCountTrigger { VocabularyEntriesCount = 1 }, user.Id, CancellationToken.None));

        Context.Achievements.Count(a => a.UserId == user.Id).ShouldBe(1);
        notifications.Verify(
            n => n.NotifyAboutUnlockedAchievementAsync(It.IsAny<Achievement>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Cancellation_is_not_swallowed()
    {
        var user = Create.User().Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        var notifications = new Mock<IUserNotificationService>();
        notifications
            .Setup(n => n.NotifyAboutUnlockedAchievementAsync(It.IsAny<Achievement>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());
        var service = new AchievementsService(Context, [new AlwaysEarned()], notifications.Object);

        await Should.ThrowAsync<OperationCanceledException>(() =>
            service.AssignAchievements(new VocabularyCountTrigger { VocabularyEntriesCount = 1 }, user.Id, CancellationToken.None));
    }
}
