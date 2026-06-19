using System;
using System.Collections.Generic;
using System.Text.Json;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;

namespace Trale.MiniApp;

public class ProgressCalculator : IProgressCalculator
{
    public ProgressUpdate CalculateLessonCompletion(
        MiniAppUserProgress progress,
        string moduleId,
        int lessonId,
        int correct,
        int total)
    {
        var completed = ParseCompletedLessons(progress.CompletedLessonsJson);
        if (!completed.TryGetValue(moduleId, out var lessons))
        {
            lessons = new List<int>();
        }

        var isPerfect = correct == total;
        var wasFirst = lessonId > 0 && !lessons.Contains(lessonId);

        // XP economy: incentivize 100% and replays
        int xpEarned;
        if (isPerfect)
        {
            xpEarned = wasFirst
                ? LearningConstants.XpRewards.PerfectFirstAttempt
                : LearningConstants.XpRewards.PerfectRepeat;
        }
        else
        {
            xpEarned = wasFirst
                ? LearningConstants.XpRewards.IncompleteFirstAttempt
                : LearningConstants.XpRewards.IncompleteRepeat;
        }

        progress.Xp += xpEarned;

        // Streak
        var todayUtc = DateTime.UtcNow.Date;
        if (progress.LastPlayedAtUtc == null)
        {
            progress.Streak = 1;
        }
        else
        {
            var last = progress.LastPlayedAtUtc.Value.Date;
            if (last == todayUtc)
            {
                // same day — keep streak
            }
            else if (last == todayUtc.AddDays(-1))
            {
                progress.Streak += 1;
            }
            else
            {
                progress.Streak = 1;
            }
        }
        progress.LastPlayedAtUtc = DateTime.UtcNow;
        RecordActivityDay(progress, DateTime.UtcNow);

        // Record completion — only on 100%, skip "vocabulary" pseudo-module
        var lessonCompleted = false;
        if (isPerfect && lessonId > 0 && moduleId != "vocabulary")
        {
            if (!lessons.Contains(lessonId))
            {
                lessons.Add(lessonId);
                lessons.Sort();
                lessonCompleted = true;
            }
            completed[moduleId] = lessons;
            progress.CompletedLessonsJson = JsonSerializer.Serialize(completed);
        }

        progress.UpdatedAtUtc = DateTime.UtcNow;

        return new ProgressUpdate(xpEarned, lessonCompleted);
    }

    public object SerializeProgress(MiniAppUserProgress progress)
    {
        var completed = ParseCompletedLessons(progress.CompletedLessonsJson);
        return new
        {
            xp = progress.Xp,
            streak = progress.Streak,
            lastPlayedAtUtc = progress.LastPlayedAtUtc,
            completedLessons = completed,
            xpSpent = progress.XpSpent,
            totalTreatsGiven = progress.TotalTreatsGiven,
            lastFedAtUtc = progress.LastFedAtUtc,
            lastTreatIndex = progress.LastTreatIndex
        };
    }

    // Append nowUtc to the activity-days log unless this UTC day is already recorded.
    // Stored as a JSON array of ISO-8601 UTC timestamps (one per played UTC day);
    // the frontend localizes each to the user's date for the heatmap. Bounded to the
    // most recent year so the column can't grow without limit.
    private static void RecordActivityDay(MiniAppUserProgress progress, DateTime nowUtc)
    {
        var days = ParseActivityDays(progress.ActivityDaysJson);

        var today = nowUtc.Date;
        if (days.Exists(d => d.Date == today)) return;

        days.Add(nowUtc);
        days.Sort();
        var cutoff = today.AddDays(-366);
        days.RemoveAll(d => d.Date < cutoff);

        progress.ActivityDaysJson = JsonSerializer.Serialize(
            days.ConvertAll(d => DateTime.SpecifyKind(d, DateTimeKind.Utc)
                .ToString("yyyy-MM-ddTHH:mm:ssZ")));
    }

    private static List<DateTime> ParseActivityDays(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            var raw = JsonSerializer.Deserialize<List<string>>(json) ?? new();
            var result = new List<DateTime>(raw.Count);
            foreach (var s in raw)
            {
                if (DateTime.TryParse(s, null,
                        System.Globalization.DateTimeStyles.AdjustToUniversal |
                        System.Globalization.DateTimeStyles.AssumeUniversal,
                        out var dt))
                {
                    result.Add(DateTime.SpecifyKind(dt, DateTimeKind.Utc));
                }
            }
            return result;
        }
        catch
        {
            return new();
        }
    }

    private static Dictionary<string, List<int>> ParseCompletedLessons(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }
}
