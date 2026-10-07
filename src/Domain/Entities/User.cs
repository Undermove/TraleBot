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
    /// <summary>End of free access earned by inviting a friend AFTER the registration-anchored
    /// window (<see cref="RegisteredAtUtc"/> + 30 + <see cref="TrialBonusDays"/>) was already over.
    /// Counted from the moment of the grant, not from registration: adding days to
    /// <see cref="TrialBonusDays"/> of someone who registered months ago would bring nothing back.
    /// Null for users who never needed it. Written only by <see cref="GrantFreeAccessDays"/>.</summary>
    public DateTime? BonusAccessUntilUtc { get; set; }
    /// <summary>Registration-anchored end of the trial: base 30 days plus accumulated bonus days.</summary>
    public DateTime RegistrationTrialEndsAtUtc => RegisteredAtUtc.AddDays(TrialDays + TrialBonusDays);
    /// <summary>When free access ends: the later of the registration-anchored trial and the
    /// bonus access granted from "now" (<see cref="BonusAccessUntilUtc"/>).</summary>
    public DateTime TrialEndsAtUtc =>
        BonusAccessUntilUtc is { } bonusUntil && bonusUntil > RegistrationTrialEndsAtUtc
            ? bonusUntil
            : RegistrationTrialEndsAtUtc;
    public Guid UserSettingsId { get; set; }
    public required bool InitialLanguageSet { get; set; }
    public bool IsActive { get; set; }
    public bool IsPro { get; set; }
    // Whether the user wants retention/return push notifications. Default on;
    // toggled from the mini-app Profile. The daily-return dispatch skips users
    // who turn this off.
    public bool NotificationsEnabled { get; set; } = true;
    public DateTime? ProPurchasedAtUtc { get; set; }
    public SubscriptionPlan? SubscriptionPlan { get; set; }

    /// <summary>
    /// First-touch acquisition source, captured from the /start deep-link payload
    /// (e.g. "site", "channel_neuralfordevs") or the mini-app start_param. Null for
    /// users who arrived before attribution shipped or with no source tag. Set once
    /// and never overwritten, so it reflects where the user originally came from.
    /// Sanitized to [A-Za-z0-9_-], lower-cased, max 64 chars.
    /// </summary>
    public string? AcquisitionSource { get; set; }
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

    /// <summary>True if user is in their free access window (trial, or a bonus period earned by
    /// inviting a friend after the trial). False if they ever became Pro
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

    /// <summary>
    /// Adds <paramref name="days"/> of free access so that they are always usable:
    /// while the registration-anchored trial is running they go to its end
    /// (<see cref="TrialBonusDays"/>); once it is over they count from <paramref name="now"/> —
    /// or from the end of a bonus period that is still running, so grants stack.
    /// Returns the new end of free access. Not for Pro users (their reward extends the subscription).
    /// </summary>
    public DateTime GrantFreeAccessDays(int days, DateTime now)
    {
        var bonusAhead = BonusAccessUntilUtc is { } bonusUntil && bonusUntil > RegistrationTrialEndsAtUtc;
        if (RegistrationTrialEndsAtUtc > now && !bonusAhead)
        {
            TrialBonusDays += days;
        }
        else
        {
            var startFrom = TrialEndsAtUtc > now ? TrialEndsAtUtc : now;
            BonusAccessUntilUtc = startFrom.AddDays(days);
        }
        return TrialEndsAtUtc;
    }

    /// <summary>
    /// A gift of access "for <paramref name="days"/> days from now" that never takes anything away:
    /// nothing changes for someone who already has that much (an active subscription, a trial or a
    /// bonus that ends later). A lapsed subscriber gets the subscription back for these days — the
    /// same way a referral reward reaches them — because the free window is closed to anyone who
    /// has ever paid (<see cref="HasActiveTrial(DateTime)"/>).
    /// Returns the new end of access, or null when nothing was changed.
    /// </summary>
    public DateTime? GiftAccessDays(int days, DateTime now)
    {
        var until = now.AddDays(days);
        if (days <= 0 || IsLifetime) return null;
        if (IsPro)
        {
            if (SubscribedUntil is { } paidUntil && paidUntil >= until) return null;
            SubscribedUntil = until;
            return until;
        }

        if (TrialEndsAtUtc >= until) return null;
        BonusAccessUntilUtc = until;
        return until;
    }

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