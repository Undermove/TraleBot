using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

public class UserWinBackTests
{
    [Test]
    public void User_WinBackSentAtUtc_DefaultsToNull()
    {
        var user = new User { InitialLanguageSet = true };

        user.WinBackSentAtUtc.ShouldBeNull();
    }

    [Test]
    public void User_SetWinBackSent_SetsTimestamp()
    {
        var user = new User { InitialLanguageSet = true };
        var specificTime = new DateTime(2026, 6, 1, 10, 30, 0, DateTimeKind.Utc);

        user.SetWinBackSent(specificTime);

        user.WinBackSentAtUtc.ShouldBe(specificTime);
    }

    [Test]
    public void User_SetWinBackSent_CalledTwice_UpdatesToLatestTimestamp()
    {
        var user = new User { InitialLanguageSet = true };
        var firstTime = new DateTime(2026, 5, 1, 8, 0, 0, DateTimeKind.Utc);
        var secondTime = new DateTime(2026, 6, 1, 10, 0, 0, DateTimeKind.Utc);

        user.SetWinBackSent(firstTime);
        user.SetWinBackSent(secondTime);

        user.WinBackSentAtUtc.ShouldBe(secondTime);
    }

    [Test]
    public void User_SetWinBackSent_WithMinDateTime_DoesNotThrow()
    {
        var user = new User { InitialLanguageSet = true };

        Should.NotThrow(() => user.SetWinBackSent(DateTime.MinValue));
    }
}
