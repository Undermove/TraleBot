using Domain.Entities;
using Shouldly;

namespace Domain.UnitTests;

/// <summary>
/// Covers the single-source-of-truth entitlement helpers on User:
/// HasActivePro, HasActiveTrial, HasMiniAppAccess, TrialDaysLeft,
/// HasExpiredPro, IsLifetime, TrialEndsAtUtc.
///
/// These helpers are how mini-app code answers "is the user paid? on trial?
/// allowed in?" Everything else (controllers, queries, services) should call
/// them rather than poking at the underlying flags.
/// </summary>
public class UserEntitlementTests
{
    private static readonly DateTime Now = new(2026, 5, 14, 12, 0, 0, DateTimeKind.Utc);

    private static User NewUser(Action<User>? configure = null)
    {
        var u = new User
        {
            InitialLanguageSet = true,
            RegisteredAtUtc = Now.AddDays(-1),
            IsPro = false,
            TrialBonusDays = 0,
            SubscribedUntil = null,
            SubscriptionPlan = null
        };
        configure?.Invoke(u);
        return u;
    }

    // ----- TrialEndsAtUtc -----

    [Test]
    public void TrialEndsAtUtc_PlainUser_IsRegistrationPlus30()
    {
        var registeredAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var user = NewUser(u => u.RegisteredAtUtc = registeredAt);

        user.TrialEndsAtUtc.ShouldBe(registeredAt.AddDays(30));
    }

    [Test]
    public void TrialEndsAtUtc_WithBonusDays_IncludesThem()
    {
        var registeredAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = registeredAt;
            u.TrialBonusDays = 25;
        });

        user.TrialEndsAtUtc.ShouldBe(registeredAt.AddDays(55));
    }

    // ----- IsLifetime -----

    [Test]
    public void IsLifetime_ProAndLifetimePlan_ReturnsTrue()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        user.IsLifetime.ShouldBeTrue();
    }

    [Test]
    public void IsLifetime_ProAndMonthPlan_ReturnsFalse()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
        });

        user.IsLifetime.ShouldBeFalse();
    }

    [Test]
    public void IsLifetime_LifetimePlanButIsProFalse_ReturnsFalse()
    {
        // Refunded Lifetime — IsPro was flipped back but plan field lingered.
        var user = NewUser(u =>
        {
            u.IsPro = false;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        user.IsLifetime.ShouldBeFalse();
    }

    // ----- HasActivePro -----

    [Test]
    public void HasActivePro_FreshUser_ReturnsFalse()
    {
        var user = NewUser();

        user.HasActivePro(Now).ShouldBeFalse();
    }

    [Test]
    public void HasActivePro_ProWithFutureExpiry_ReturnsTrue()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(15);
        });

        user.HasActivePro(Now).ShouldBeTrue();
    }

    [Test]
    public void HasActivePro_ProWithPastExpiry_ReturnsFalse()
    {
        // The renewal-prompt audience.
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-1);
        });

        user.HasActivePro(Now).ShouldBeFalse();
    }

    [Test]
    public void HasActivePro_Lifetime_ReturnsTrueRegardlessOfSubscribedUntil()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
            u.SubscribedUntil = null;
        });

        user.HasActivePro(Now).ShouldBeTrue();
    }

    [Test]
    public void HasActivePro_NonProEvenWithFutureSubscribedUntil_ReturnsFalse()
    {
        // Defensive: paranoid case where IsPro got flipped off but SubscribedUntil lingers.
        var user = NewUser(u =>
        {
            u.IsPro = false;
            u.SubscribedUntil = Now.AddDays(15);
        });

        user.HasActivePro(Now).ShouldBeFalse();
    }

    [Test]
    public void HasActivePro_ExactlyAtExpiry_ReturnsFalse()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now;
        });

        user.HasActivePro(Now).ShouldBeFalse();
    }

    // ----- HasExpiredPro -----

    [Test]
    public void HasExpiredPro_ProWithPastExpiry_ReturnsTrue()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-3);
        });

        user.HasExpiredPro(Now).ShouldBeTrue();
    }

    [Test]
    public void HasExpiredPro_ActivePro_ReturnsFalse()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(10);
        });

        user.HasExpiredPro(Now).ShouldBeFalse();
    }

    [Test]
    public void HasExpiredPro_NeverPaidUser_ReturnsFalse()
    {
        var user = NewUser();

        user.HasExpiredPro(Now).ShouldBeFalse();
    }

    [Test]
    public void HasExpiredPro_Lifetime_ReturnsFalse()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        user.HasExpiredPro(Now).ShouldBeFalse();
    }

    // ----- HasActiveTrial -----

    [Test]
    public void HasActiveTrial_NewlyRegistered_ReturnsTrue()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-5));

        user.HasActiveTrial(Now).ShouldBeTrue();
    }

    [Test]
    public void HasActiveTrial_31DaysAfterRegistration_ReturnsFalse()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-31));

        user.HasActiveTrial(Now).ShouldBeFalse();
    }

    [Test]
    public void HasActiveTrial_TrialExpiredButBonusDaysExtendIt_ReturnsTrue()
    {
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-35); // base trial ended 5 days ago
            u.TrialBonusDays = 10; // bonus pushes end to 5 days in the future
        });

        user.HasActiveTrial(Now).ShouldBeTrue();
    }

    [Test]
    public void HasActiveTrial_UserIsPro_ReturnsFalse()
    {
        // Once IsPro=true, trial is considered consumed even if dates suggest otherwise.
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-5);
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(20);
        });

        user.HasActiveTrial(Now).ShouldBeFalse();
    }

    [Test]
    public void HasActiveTrial_ExpiredProUser_ReturnsFalse()
    {
        // Ex-Pro doesn't fall back into trial — they need to renew.
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-2);
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-1);
        });

        user.HasActiveTrial(Now).ShouldBeFalse();
    }

    // ----- HasMiniAppAccess (the headline check) -----

    [Test]
    public void HasMiniAppAccess_ActivePro_True()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(15);
        });

        user.HasMiniAppAccess(Now).ShouldBeTrue();
    }

    [Test]
    public void HasMiniAppAccess_ActiveTrial_True()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-2));

        user.HasMiniAppAccess(Now).ShouldBeTrue();
    }

    [Test]
    public void HasMiniAppAccess_Lifetime_True()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        user.HasMiniAppAccess(Now).ShouldBeTrue();
    }

    [Test]
    public void HasMiniAppAccess_ExpiredProNoTrialLeft_False()
    {
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-60);
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-2);
        });

        user.HasMiniAppAccess(Now).ShouldBeFalse();
    }

    [Test]
    public void HasMiniAppAccess_ExpiredTrialNeverPaid_False()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-31));

        user.HasMiniAppAccess(Now).ShouldBeFalse();
    }

    // ----- TrialDaysLeft -----

    [Test]
    public void TrialDaysLeft_NewlyRegistered_Returns30()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now);

        user.TrialDaysLeft(Now).ShouldBe(30);
    }

    [Test]
    public void TrialDaysLeft_HalfwayThroughTrial_Returns15()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-15));

        user.TrialDaysLeft(Now).ShouldBe(15);
    }

    [Test]
    public void TrialDaysLeft_ExpiredTrial_Returns0()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-31));

        user.TrialDaysLeft(Now).ShouldBe(0);
    }

    [Test]
    public void TrialDaysLeft_ProUser_Returns0()
    {
        // Even within base trial window — if they bought Pro, trial is consumed.
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-2);
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(28);
        });

        user.TrialDaysLeft(Now).ShouldBe(0);
    }

    [Test]
    public void TrialDaysLeft_TrialBonusDays_AddsToRemaining()
    {
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-10);
            u.TrialBonusDays = 14;
        });

        // 30-10+14 = 34 days remaining (with ceiling rounding for partial day).
        user.TrialDaysLeft(Now).ShouldBe(34);
    }

    // ----- HasMiniAppAccess "renewal pain" scenario -----

    // ----- ShouldShowReferralExtensionCta -----

    [Test]
    public void ExtensionCta_HiddenForLifetime()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Lifetime;
        });

        user.ShouldShowReferralExtensionCta(Now).ShouldBeFalse();
    }

    [Test]
    public void ExtensionCta_HiddenForActivePro()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(20);
        });

        user.ShouldShowReferralExtensionCta(Now).ShouldBeFalse();
    }

    [Test]
    public void ExtensionCta_HiddenForFreshTrial()
    {
        // 28 days left — nothing to worry about yet.
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-2));

        user.ShouldShowReferralExtensionCta(Now).ShouldBeFalse();
    }

    [Test]
    public void ExtensionCta_VisibleWhenTrialEndsWithinThreshold()
    {
        // ~3 days left (User.TrialExtensionCtaThresholdDays).
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-User.TrialDays + User.TrialExtensionCtaThresholdDays));

        user.ShouldShowReferralExtensionCta(Now).ShouldBeTrue();
    }

    [Test]
    public void ExtensionCta_VisibleOnLastDayOfTrial()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-User.TrialDays + 1).AddHours(-1));

        user.ShouldShowReferralExtensionCta(Now).ShouldBeTrue();
    }

    [Test]
    public void ExtensionCta_VisibleForExpiredTrial()
    {
        var user = NewUser(u => u.RegisteredAtUtc = Now.AddDays(-User.TrialDays - 5));

        user.ShouldShowReferralExtensionCta(Now).ShouldBeTrue();
    }

    [Test]
    public void ExtensionCta_VisibleForExpiredPro()
    {
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-2);
            u.RegisteredAtUtc = Now.AddDays(-60);
        });

        user.ShouldShowReferralExtensionCta(Now).ShouldBeTrue();
    }

    [Test]
    public void ExtensionCta_RespectsTrialBonusDays()
    {
        // User has 2 days base trial left but +10 bonus days → 12 days remaining → CTA hidden.
        var user = NewUser(u =>
        {
            u.RegisteredAtUtc = Now.AddDays(-User.TrialDays + 2);
            u.TrialBonusDays = 10;
        });

        user.ShouldShowReferralExtensionCta(Now).ShouldBeFalse();
    }

    [Test]
    public void RenewalScenario_ExpiredProUserBuysAgain_HasActiveProBecomesTrue()
    {
        // Simulates the flow after the Purchase endpoint stops gating on stored IsPro:
        // an expired-Pro user re-purchases, SubscribedUntil moves into the future,
        // and HasActivePro flips back to true.
        var user = NewUser(u =>
        {
            u.IsPro = true;
            u.SubscriptionPlan = SubscriptionPlan.Month;
            u.SubscribedUntil = Now.AddDays(-2);
        });

        user.HasActivePro(Now).ShouldBeFalse(); // baseline: lapsed

        user.SubscribedUntil = Now.AddDays(30);

        user.HasActivePro(Now).ShouldBeTrue();
        user.HasMiniAppAccess(Now).ShouldBeTrue();
    }
}
