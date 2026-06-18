using System;
using System.Collections.Generic;

namespace Application.Onboarding;

/// <summary>
/// Progress signals the onboarding engine reasons over. "Real" excludes the
/// throwaway "welcome" module so the very first nudge is "do a real lesson".
/// </summary>
public record OnboardingSignals(
    int RealLessonsCompleted,
    int DistinctRealModules,
    int AvailableXp,
    int TotalTreatsGiven,
    int VocabularyCount);

/// <summary>Persisted state: which hints were already surfaced and when the last one was shown.</summary>
public record OnboardingHintState(IReadOnlySet<string> Seen, DateTime? LastShownAt);

/// <summary>
/// Contextual, time-spread onboarding. After the welcome win we gently guide the user deeper —
/// one nudge at a time, each shown once, and at most one new nudge per ~20h so the steps land
/// across days/sessions instead of all at once. The active hint is the first step that is
/// eligible (its action not yet done) and not yet seen.
/// </summary>
public static class OnboardingHints
{
    public const string FirstLesson = "first_lesson";
    public const string NextLesson = "next_lesson";
    public const string ExploreModule = "explore_module";
    public const string FeedBombora = "feed_bombora";
    public const string AddVocab = "add_vocab";

    /// <summary>Priority order — the active hint is the first eligible, unseen step here.</summary>
    public static readonly IReadOnlyList<string> Order = new[]
    {
        FirstLesson, NextLesson, ExploreModule, FeedBombora, AddVocab,
    };

    /// <summary>Cheapest treat price — mirrors FeedTreatService.TreatPrices[0].</summary>
    private const int CheapestTreatXp = 10;

    /// <summary>Don't surface a new hint within this window of the previous one — spreads steps over days.</summary>
    public static readonly TimeSpan MinGapBetweenHints = TimeSpan.FromHours(20);

    public static string? ResolveActiveHint(OnboardingSignals signals, OnboardingHintState state, DateTime nowUtc)
    {
        // One new nudge per window — keeps the onboarding gentle and time-spread.
        if (state.LastShownAt is { } last && nowUtc - last < MinGapBetweenHints)
        {
            return null;
        }

        foreach (var key in Order)
        {
            if (!state.Seen.Contains(key) && IsEligible(key, signals))
            {
                return key;
            }
        }

        return null;
    }

    private static bool IsEligible(string key, OnboardingSignals s) => key switch
    {
        // Only the welcome lesson done so far — point them at a real lesson.
        FirstLesson => s.RealLessonsCompleted == 0,
        // Got going but not yet into a rhythm — encourage the next lesson.
        NextLesson => s.RealLessonsCompleted is >= 1 and < 3,
        // Several lessons but all in one module — nudge toward breadth.
        ExploreModule => s.RealLessonsCompleted >= 3 && s.DistinctRealModules <= 1,
        // Earned enough to spend but never fed Bombora — show the treat loop.
        FeedBombora => s.AvailableXp >= CheapestTreatXp && s.TotalTreatsGiven == 0,
        // A couple of lessons in but the personal dictionary is still empty.
        AddVocab => s.RealLessonsCompleted >= 2 && s.VocabularyCount == 0,
        _ => false,
    };
}
