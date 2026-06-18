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
