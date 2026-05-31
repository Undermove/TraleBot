using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

public class UserNotificationsTests
{
    [Test]
    public void User_NotificationsEnabled_DefaultsToTrue()
    {
        var user = new User { InitialLanguageSet = true };

        user.NotificationsEnabled.ShouldBe(true);
    }

    [Test]
    public void User_NotificationsEnabled_CanBeSetToFalse()
    {
        var user = new User { InitialLanguageSet = true };

        user.NotificationsEnabled = false;

        user.NotificationsEnabled.ShouldBe(false);
    }

    [Test]
    public void User_NotificationsEnabled_CanBeSetToTrueAfterFalse()
    {
        var user = new User { InitialLanguageSet = true };
        user.NotificationsEnabled = false;

        user.NotificationsEnabled = true;

        user.NotificationsEnabled.ShouldBe(true);
    }

    [Test]
    public void NotificationTrigger_CanBeCreatedWithRequiredFields()
    {
        var id = Guid.NewGuid();
        var lastSentAt = new DateTime(2026, 5, 31, 10, 0, 0, DateTimeKind.Utc);

        var trigger = new NotificationTrigger
        {
            Id = id,
            UserId = 12345L,
            Source = "daily_return",
            LastSentAt = lastSentAt,
            Variant = "A"
        };

        trigger.Id.ShouldBe(id);
        trigger.UserId.ShouldBe(12345L);
        trigger.Source.ShouldBe("daily_return");
        trigger.LastSentAt.ShouldBe(lastSentAt);
        trigger.Variant.ShouldBe("A");
    }

    [Test]
    public void NotificationTrigger_Variant_IsNullable()
    {
        var trigger = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = 99L,
            Source = "daily_return",
            LastSentAt = DateTime.UtcNow,
            Variant = null
        };

        trigger.Variant.ShouldBeNull();
    }
}
