using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

public class UserTests
{
    [Test]
    public void IsActivePremium_NonPremiumAccount_ReturnsFalse()
    {
        var user = new User
        {
            InitialLanguageSet = true,
            AccountType = UserAccountType.Free,
            SubscribedUntil = null,
        };

        user.IsActivePremium().ShouldBeFalse();
    }

    [Test]
    public void IsActivePremium_PremiumWithNullSubscribedUntil_ReturnsTrue()
    {
        // Lifetime subscription: GrantProService sets SubscribedUntil = null.
        var user = new User
        {
            InitialLanguageSet = true,
            AccountType = UserAccountType.Premium,
            SubscribedUntil = null,
        };

        user.IsActivePremium().ShouldBeTrue();
    }

    [Test]
    public void IsActivePremium_PremiumWithFutureDate_ReturnsTrue()
    {
        var user = new User
        {
            InitialLanguageSet = true,
            AccountType = UserAccountType.Premium,
            SubscribedUntil = DateTime.UtcNow.AddDays(30),
        };

        user.IsActivePremium().ShouldBeTrue();
    }

    [Test]
    public void IsActivePremium_PremiumWithPastDate_ReturnsFalse()
    {
        var user = new User
        {
            InitialLanguageSet = true,
            AccountType = UserAccountType.Premium,
            SubscribedUntil = DateTime.UtcNow.AddDays(-1),
        };

        user.IsActivePremium().ShouldBeFalse();
    }
}
