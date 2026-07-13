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

    object SerializeProgress(MiniAppUserProgress progress);
}

public record ProgressUpdate(int XpEarned, bool LessonCompleted);

public record AnswerUpdate(int XpEarned);
