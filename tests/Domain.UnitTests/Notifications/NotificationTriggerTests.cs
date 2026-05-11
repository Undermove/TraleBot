using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests.Notifications;

public class NotificationTriggerTests
{
    [Test]
    public void NotificationTrigger_DefaultValues_AreCorrect()
    {
        var trigger = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Source = NotificationSource.Streak,
        };

        trigger.NextStreakMilestone.ShouldBe(7);
        trigger.LastSentAt.ShouldBeNull();
    }

    [Test]
    public void User_NotificationsEnabled_DefaultsToTrue()
    {
        var user = new User
        {
            InitialLanguageSet = true,
        };

        user.NotificationsEnabled.ShouldBeTrue();
    }
}
