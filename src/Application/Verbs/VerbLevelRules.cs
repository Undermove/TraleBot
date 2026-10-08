using System;
using System.Collections.Generic;
using System.Linq;
using Domain.Entities;

namespace Application.Verbs;

/// <summary>
/// How a verb's level follows from the progress of its forms and from the exam. The only copy of
/// these rules: the mini-app receives the level and displays it, it never computes one.
/// </summary>
public static class VerbLevelRules
{
    /// <summary>
    /// A form is "solid" once the learner has met it, recognised it and picked it out of options
    /// (the ladder's steps "meaning" and "form" are behind it). Same value as SOLID_STEP in the mini-app's engine.
    /// </summary>
    public const int SolidStep = 3;

    /// <summary>Solid forms that make a verb "recognised".</summary>
    public const int RecognisingForms = 2;

    /// <summary>The exam asks at least this many forms (or all of them when the verb has fewer).</summary>
    public const int ExamMinQuestions = 6;

    /// <summary>Mistakes the exam forgives.</summary>
    public const int ExamMistakesAllowed = 1;

    /// <param name="cells">How many main forms the verb has.</param>
    /// <param name="bestSteps">Best step of every form the learner has started.</param>
    public static VerbLevel Derive(int cells, IReadOnlyCollection<int> bestSteps, bool examPassed)
    {
        if (examPassed)
        {
            return VerbLevel.Learned;
        }

        if (cells <= 0 || bestSteps.Count == 0)
        {
            return VerbLevel.New;
        }

        var solid = bestSteps.Count(step => step >= SolidStep);
        if (solid * 3 >= cells * 2)
        {
            return VerbLevel.ExamReady;
        }

        if (solid * 3 >= cells)
        {
            return VerbLevel.Phrases;
        }

        return solid >= Math.Min(RecognisingForms, cells) ? VerbLevel.Recognising : VerbLevel.Meeting;
    }

    /// <summary>Whether an exam of <paramref name="asked"/> questions with <paramref name="correct"/> right answers is passed.</summary>
    public static bool ExamPassed(int cells, int asked, int correct) =>
        asked >= Math.Min(ExamMinQuestions, cells) && asked > 0 && correct <= asked && correct >= asked - ExamMistakesAllowed;

    /// <summary>Questions in the prefix check of a family member (the last scene of its prefix session).</summary>
    public const int PrefixCheckQuestions = 6;

    /// <summary>
    /// A family member — the family's base verb with a direction prefix — becomes "learned" without
    /// an exam of its own: its endings are the base verb's, already examined. It takes both
    /// (1) the base verb is learned and (2) the member's prefix check is passed:
    /// <see cref="PrefixCheckQuestions"/> one-attempt questions that tell this prefix from the
    /// family's other ones, with at most <see cref="ExamMistakesAllowed"/> mistake. A check played
    /// while the base is not learned does not count. The old way stays open: a member's own exam
    /// (<see cref="ExamPassed"/>) makes it learned whatever the base is, and a member learned
    /// before families existed stays learned — the exam mark is never taken back.
    /// </summary>
    public static bool PrefixCheckPassed(bool baseLearned, int asked, int correct) =>
        baseLearned && asked >= PrefixCheckQuestions && correct <= asked && correct >= asked - ExamMistakesAllowed;

    /// <summary>The name the mini-app and its API use for a level.</summary>
    public static string Key(VerbLevel level) => level switch
    {
        VerbLevel.Meeting => "meeting",
        VerbLevel.Recognising => "recognising",
        VerbLevel.Phrases => "phrases",
        VerbLevel.ExamReady => "examReady",
        VerbLevel.Learned => "learned",
        _ => "new"
    };
}
