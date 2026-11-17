using System;
using System.Collections.Generic;
using System.Linq;
using Application.Common;

namespace Application.DailyTask;

public record CourseLesson(int Id, string Title);

public record CourseModule(string Id, string Title, IReadOnlyList<CourseLesson> Lessons);

/// <summary>
/// The next step of the course for a learner who walked it out of order: what to finish, what is
/// already known (and only needs a one-minute check) and where to go next. Rules only — the order of
/// modules is written by hand, the rest is counted from passed lessons.
/// </summary>
public static class CoursePlanner
{
    /// <summary>The check was passed: the module's skipped lessons are not offered.</summary>
    public const string Known = "known";

    /// <summary>The check was failed: the skipped lessons come back one at a time.</summary>
    public const string Lessons = "lessons";

    public const int CheckQuestions = 6;

    /// <summary>
    /// With this many lessons passed outside the alphabet the learner evidently reads: the alphabet's
    /// word-reading lessons are not offered once the letters are done.
    /// </summary>
    private const int ReadsAlready = 10;

    /// <summary>A started module from this share of passed lessons is finished before anything else.</summary>
    private const double AlmostDone = 0.5;

    /// <summary>The order the course is walked in; modules missing here follow in catalog order.</summary>
    private static readonly string[] Order =
    {
        LearningConstants.Modules.Alphabet, "intro", "my-day", "numbers", "pronouns", "present-tense", "cases",
        "postpositions", "adjectives", "cafe", "taxi", "shopping", "doctor", "emergency", "verbs-of-movement"
    };

    public static DailyNew? Next(
        IReadOnlyList<CourseModule> catalog,
        IReadOnlyDictionary<string, IReadOnlyCollection<int>> completed,
        IReadOnlyDictionary<string, string> verdicts)
    {
        var modules = catalog
            .Where(m => m.Lessons.Count > 0)
            .Select(m =>
            {
                var done = completed.TryGetValue(m.Id, out var ids) ? ids : Array.Empty<int>();
                var left = m.Lessons.Where(l => !done.Contains(l.Id)).ToList();
                return new State(m, m.Lessons.Count - left.Count, left, verdicts.GetValueOrDefault(m.Id));
            })
            .Where(s => s.Left.Count > 0 && s.Verdict != Known)
            .ToList();

        // The alphabet: letters are done and plenty is passed elsewhere — its reading lessons are not needed.
        var outsideAlphabet = completed
            .Where(c => c.Key != LearningConstants.Modules.Alphabet && catalog.Any(m => m.Id == c.Key))
            .Sum(c => c.Value.Count);
        modules.RemoveAll(s =>
            s.Module.Id == LearningConstants.Modules.Alphabet
            && s.Left.All(l => l.Id > LearningConstants.Modules.AlphabetLetterLessons)
            && outsideAlphabet >= ReadsAlready);

        // 1. Almost finished — finish it: the closest to the end first.
        var almost = modules
            .Where(s => s.Done > 0 && s.Done >= s.Module.Lessons.Count * AlmostDone)
            .OrderBy(s => s.Left.Count)
            .FirstOrDefault();
        if (almost != null)
        {
            var left = almost.Left.Count - 1;
            return Lesson(almost, almost.Left[0],
                $"Модуль «{almost.Module.Title}»: пройдено {almost.Done} из {almost.Module.Lessons.Count}. "
                + (left == 0
                    ? "Это последний урок — пройди его и закрой модуль."
                    : $"Пройди этот урок — до конца модуля останется {left}."));
        }

        var ordered = modules
            .OrderBy(s => Array.IndexOf(Order, s.Module.Id) is var i && i >= 0 ? i : int.MaxValue)
            .ToList();

        // 2. The final lesson is passed while lessons before it are skipped: either the learner knows
        //    the module (a one-minute check settles it), or the check showed gaps and lessons come back.
        var jumped = ordered.FirstOrDefault(s => s.Left.All(l => l.Id != s.Module.Lessons[^1].Id));
        if (jumped != null)
        {
            if (jumped.Verdict == Lessons)
            {
                return Lesson(jumped, jumped.Left[0],
                    $"Проверка показала пробелы. Пройди пропущенные уроки модуля «{jumped.Module.Title}» по одному: осталось {jumped.Left.Count}.");
            }

            var questions = Math.Min(CheckQuestions, jumped.Left.Count);
            return new DailyNew(
                DailyNew.Check,
                jumped.Module.Title,
                "проверка на минуту",
                $"Последний урок модуля «{jumped.Module.Title}» у тебя пройден, а {DailyTaskPlanner.Count(jumped.Left.Count, "урок пропущен", "урока пропущены", "уроков пропущены")}. "
                + $"Ответь без ошибок на {DailyTaskPlanner.Count(questions, "вопрос", "вопроса", "вопросов")} из них — и модуль закрыт.",
                "Пройти проверку",
                ModuleId: jumped.Module.Id,
                CheckLessons: Spread(jumped.Left.Select(l => l.Id).ToList(), questions));
        }

        // 3. The next module of the course.
        var next = ordered.FirstOrDefault();
        if (next == null)
        {
            return null;
        }

        return Lesson(next, next.Left[0], next.Done == 0
            ? $"Следующий модуль курса — «{next.Module.Title}»: {DailyTaskPlanner.Count(next.Module.Lessons.Count, "короткий урок", "коротких урока", "коротких уроков")}. Пройди первый."
            : $"Модуль «{next.Module.Title}»: пройдено {next.Done} из {next.Module.Lessons.Count}. Пройди следующий урок.");
    }

    private record State(CourseModule Module, int Done, List<CourseLesson> Left, string? Verdict);

    private static DailyNew Lesson(State state, CourseLesson lesson, string say)
    {
        var number = state.Module.Lessons.ToList().FindIndex(l => l.Id == lesson.Id) + 1;
        return new DailyNew(
            DailyNew.Lesson,
            state.Module.Title,
            $"урок {number} из {state.Module.Lessons.Count} · {lesson.Title}",
            say,
            "Пройти урок",
            ModuleId: state.Module.Id,
            LessonId: lesson.Id);
    }

    /// <summary>Evenly over the skipped lessons, so the check covers the whole module.</summary>
    private static List<int> Spread(List<int> ids, int count)
    {
        if (ids.Count <= count)
        {
            return ids;
        }

        return Enumerable.Range(0, count).Select(i => ids[i * (ids.Count - 1) / (count - 1)]).Distinct().ToList();
    }
}
