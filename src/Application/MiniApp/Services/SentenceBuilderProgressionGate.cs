namespace Application.MiniApp.Services;

/// <summary>Lightweight projection of a sentence-builder question used by the progression gate.</summary>
public record SentenceBuilderQuestionSlot(string Id, int Level);

/// <summary>
/// Pure filtering logic for sentence-builder progression gating.
/// L4 questions are only included once all L3 questions in the set are mastered (≥2 correct answers each).
/// L5 questions are only included once all L4 questions are mastered by the same threshold.
/// L1/L2/L3 questions are always included regardless of mastery state.
/// </summary>
public static class SentenceBuilderProgressionGate
{
    public const int MasteryThreshold = 2;

    /// <param name="questions">All sentence-builder questions for the lesson/module.</param>
    /// <param name="correctCounts">Map of questionId → number of times answered correctly by the user.</param>
    public static IReadOnlyList<SentenceBuilderQuestionSlot> FilterByProgression(
        IReadOnlyList<SentenceBuilderQuestionSlot> questions,
        IReadOnlyDictionary<string, int> correctCounts)
    {
        var byLevel = questions
            .GroupBy(q => q.Level)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<SentenceBuilderQuestionSlot>)g.ToList());

        bool l3Mastered = IsLevelMastered(byLevel, 3, correctCounts);
        bool l4Mastered = l3Mastered && IsLevelMastered(byLevel, 4, correctCounts);

        return questions
            .Where(q => q.Level switch
            {
                4 => l3Mastered,
                5 => l4Mastered,
                _ => true
            })
            .ToList();
    }

    private static bool IsLevelMastered(
        Dictionary<int, IReadOnlyList<SentenceBuilderQuestionSlot>> byLevel,
        int level,
        IReadOnlyDictionary<string, int> correctCounts)
    {
        if (!byLevel.TryGetValue(level, out var levelQuestions) || levelQuestions.Count == 0)
            return false;

        return levelQuestions.All(q =>
            correctCounts.TryGetValue(q.Id, out var count) && count >= MasteryThreshold);
    }
}
