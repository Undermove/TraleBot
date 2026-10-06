using Domain.Entities;

namespace Application.Common.Interfaces.MiniApp;

public interface IProgressCalculator
{
    ProgressUpdate CalculateLessonCompletion(
        MiniAppUserProgress progress,
        string moduleId,
        int lessonId,
        int correct,
        int total);

    AnswerUpdate RecordAnswer(MiniAppUserProgress progress, bool correct);

    /// <summary>
    /// Credits practice that is not a lesson (a verb session): adds XP and marks the day active
    /// the same way a finished lesson does.
    /// </summary>
    void CreditPractice(MiniAppUserProgress progress, int xp);

    /// <summary>How many lessons of a module the user completed.</summary>
    int CompletedLessons(MiniAppUserProgress progress, string moduleId);

    object SerializeProgress(MiniAppUserProgress progress);
}

public record ProgressUpdate(int XpEarned, bool LessonCompleted);

public record AnswerUpdate(int XpEarned);
