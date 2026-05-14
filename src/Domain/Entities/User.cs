// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global
#pragma warning disable CS8618
namespace Domain.Entities;

public class User
{
    public const int TrialDays = 30;

    public Guid Id { get; set; }
    public long TelegramId { get; set; }
    public UserAccountType AccountType { get; set; }
    public DateTime? SubscribedUntil { get; set; }
    public DateTime RegisteredAtUtc { get; set; }
    /// <summary>Cumulative bonus trial days earned via referrals (own or as a referee).
    /// Added to the base 30-day window so bonuses stack and survive trial expiry.</summary>
    public int TrialBonusDays { get; set; }
    public DateTime TrialEndsAtUtc => RegisteredAtUtc.AddDays(TrialDays + TrialBonusDays);
    public Guid UserSettingsId { get; set; }
    public required bool InitialLanguageSet { get; set; }
    public bool IsActive { get; set; }
    public bool IsPro { get; set; }
    public DateTime? ProPurchasedAtUtc { get; set; }
    public SubscriptionPlan? SubscriptionPlan { get; set; }
    public virtual UserSettings Settings { get; set; }
    public virtual ICollection<VocabularyEntry> VocabularyEntries { get; set; }
    public virtual ICollection<Quiz> Quizzes { get; set; }
    public virtual ICollection<Invoice> Invoices { get; set; }
    public virtual ICollection<Achievement> Achievements { get; set; }
    public virtual ICollection<ShareableQuiz> ShareableQuizzes { get; set; }
    public virtual ICollection<Payment> Payments { get; set; }

    public bool IsActivePremium()
    {
        if (AccountType != UserAccountType.Premium) return false;
        // Lifetime subscription: SubscribedUntil is null (see GrantProService).
        if (!SubscribedUntil.HasValue) return true;
        return SubscribedUntil.Value.Date > DateTime.UtcNow;
    }

    // ============================================================================
    // Mini-app entitlement model — single source of truth.
    // Mini-app code MUST go through these helpers instead of inspecting IsPro /
    // SubscribedUntil / TrialBonusDays directly. Keeps the "is the user paid?"
    // and "is the user on trial?" logic in one place so expiry is handled uniformly.
    // ============================================================================

    public bool IsLifetime => IsPro && SubscriptionPlan == Entities.SubscriptionPlan.Lifetime;

    /// <summary>User currently has a non-expired paid subscription (or Lifetime).</summary>
    public bool HasActivePro(DateTime now)
    {
        if (!IsPro) return false;
        if (IsLifetime) return true;
        return SubscribedUntil.HasValue && SubscribedUntil.Value > now;
    }

    public bool HasActivePro() => HasActivePro(DateTime.UtcNow);

    /// <summary>User purchased Pro at some point but the subscription has lapsed.
    /// They're the renewal-prompt audience.</summary>
    public bool HasExpiredPro(DateTime now) => IsPro && !HasActivePro(now);
    public bool HasExpiredPro() => HasExpiredPro(DateTime.UtcNow);

    /// <summary>True if user is in their free trial window. False if they ever became Pro
    /// (even if that subscription has since expired — once Pro, always counted as having used the trial).</summary>
    public bool HasActiveTrial(DateTime now) => !IsPro && TrialEndsAtUtc > now;
    public bool HasActiveTrial() => HasActiveTrial(DateTime.UtcNow);

    /// <summary>The single entitlement check: should the user be allowed to use Pro-gated features?</summary>
    public bool HasMiniAppAccess(DateTime now) => HasActivePro(now) || HasActiveTrial(now);
    public bool HasMiniAppAccess() => HasMiniAppAccess(DateTime.UtcNow);

    /// <summary>Days remaining in the trial, ceiling. Zero if trial is not active.</summary>
    public int TrialDaysLeft(DateTime now)
    {
        if (!HasActiveTrial(now)) return 0;
        return (int)Math.Ceiling((TrialEndsAtUtc - now).TotalDays);
    }
    public int TrialDaysLeft() => TrialDaysLeft(DateTime.UtcNow);

    /// <summary>How many days before trial end we start surfacing the "extend via referral" CTA.</summary>
    public const int TrialExtensionCtaThresholdDays = 3;

    /// <summary>Should the "Продли бесплатно — пригласи друга" CTA be visible to this user?
    /// Visible when: trial is ending within TrialExtensionCtaThresholdDays OR there's no
    /// active entitlement at all (trial ended, never paid, or Pro lapsed) — and the user
    /// isn't on Lifetime (no value in extending an unlimited plan).</summary>
    public bool ShouldShowReferralExtensionCta(DateTime now)
    {
        if (IsLifetime) return false;
        if (HasActivePro(now)) return false; // Pro user has plenty of time — surface elsewhere.
        if (HasActiveTrial(now)) return TrialDaysLeft(now) <= TrialExtensionCtaThresholdDays;
        // No active trial and no active Pro → the renewal-prompt audience.
        return true;
    }
    public bool ShouldShowReferralExtensionCta() => ShouldShowReferralExtensionCta(DateTime.UtcNow);
}