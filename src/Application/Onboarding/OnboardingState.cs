using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Domain.Entities;

namespace Application.Onboarding;

/// <summary>
/// (De)serializes the onboarding hint state stored in
/// <see cref="MiniAppUserProgress.OnboardingHintsJson"/> and builds the
/// <see cref="OnboardingSignals"/> the engine reasons over.
/// </summary>
public static class OnboardingState
{
    private const string WelcomeModuleId = "welcome";

    private class StateDto
    {
        [JsonPropertyName("seen")] public List<string> Seen { get; set; } = new();
        [JsonPropertyName("lastShownAt")] public DateTime? LastShownAt { get; set; }
    }

    public static OnboardingHintState Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new OnboardingHintState(new HashSet<string>(), null);
        }

        try
        {
            var dto = JsonSerializer.Deserialize<StateDto>(json);
            if (dto == null) return new OnboardingHintState(new HashSet<string>(), null);
            return new OnboardingHintState(new HashSet<string>(dto.Seen), dto.LastShownAt);
        }
        catch
        {
            return new OnboardingHintState(new HashSet<string>(), null);
        }
    }

    /// <summary>Records <paramref name="hintKey"/> as shown at <paramref name="nowUtc"/>; returns the new JSON.</summary>
    public static string MarkSeen(string? json, string hintKey, DateTime nowUtc)
    {
        var state = Parse(json);
        var seen = new HashSet<string>(state.Seen) { hintKey };
        var dto = new StateDto { Seen = seen.ToList(), LastShownAt = nowUtc };
        return JsonSerializer.Serialize(dto);
    }

    /// <summary>
    /// Records a one-time interface hint as seen. Unlike <see cref="MarkSeen"/> it leaves
    /// <c>lastShownAt</c> alone: interface hints do not delay the next onboarding step.
    /// Returns the JSON unchanged when the hint is already there or the list is full.
    /// </summary>
    public static string? MarkUiHintSeen(string? json, string hintKey)
    {
        var state = Parse(json);
        if (state.Seen.Contains(hintKey) || state.Seen.Count(OnboardingHints.IsUiHint) >= OnboardingHints.MaxUiHints)
        {
            return json;
        }

        var dto = new StateDto { Seen = state.Seen.Append(hintKey).ToList(), LastShownAt = state.LastShownAt };
        return JsonSerializer.Serialize(dto);
    }

    /// <summary>The interface hints the user has already seen.</summary>
    public static IReadOnlyList<string> UiHintsSeen(string? json) =>
        Parse(json).Seen.Where(OnboardingHints.IsUiHint).OrderBy(k => k).ToList();

    public static OnboardingSignals BuildSignals(MiniAppUserProgress progress, int vocabularyCount)
    {
        var completed = ParseCompletedLessons(progress.CompletedLessonsJson);
        var realModules = completed
            .Where(kv => kv.Key != WelcomeModuleId && kv.Value.Count > 0)
            .ToList();

        var realLessons = realModules.Sum(kv => kv.Value.Count);
        var distinctModules = realModules.Count;
        var availableXp = Math.Max(0, progress.Xp - progress.XpSpent);
        var completedWelcome = completed.TryGetValue(WelcomeModuleId, out var w) && w.Count > 0;

        return new OnboardingSignals(
            RealLessonsCompleted: realLessons,
            DistinctRealModules: distinctModules,
            AvailableXp: availableXp,
            TotalTreatsGiven: progress.TotalTreatsGiven,
            VocabularyCount: vocabularyCount,
            CompletedWelcome: completedWelcome);
    }

    private static Dictionary<string, List<int>> ParseCompletedLessons(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json)
                   ?? new Dictionary<string, List<int>>();
        }
        catch
        {
            return new Dictionary<string, List<int>>();
        }
    }
}
