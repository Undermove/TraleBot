using Application.Verbs;
using Infrastructure.Telegram.Services;

namespace Trale.MiniApp;

/// <summary>Which texts of a lesson question are searched for a catalog verb form.</summary>
public static class LessonQuestionVerbs
{
    public static LessonQuestionTexts ToTexts(QuizQuestionData q) => new(
        CorrectAnswer: q.AnswerIndex >= 0 && q.AnswerIndex < q.Options.Count ? q.Options[q.AnswerIndex] : null,
        BuiltSentence: q.SentenceBuilder == null ? null : string.Join(' ', q.SentenceBuilder.CorrectOrder),
        Transcript: q.Transcript,
        Question: q.Question);
}
