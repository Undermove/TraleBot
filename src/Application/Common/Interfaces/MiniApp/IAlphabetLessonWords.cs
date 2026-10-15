namespace Application.Common.Interfaces.MiniApp;

/// <summary>
/// The base vocabulary of the alphabet lessons (<c>alphabet-progressive</c>): the Georgian words each lesson
/// teaches with their Russian translation, as the lesson theory gives them. The server's own list — what
/// goes into a learner's dictionary after a lesson is never taken from the client.
/// </summary>
public interface IAlphabetLessonWords
{
    /// <summary>The words a lesson teaches: a words lesson (id 12+) — its 2–4 words; a letters lesson (1..11) — none.</summary>
    IReadOnlyList<AlphabetWord> WordsOf(int lessonId);

    /// <summary>The words lessons in module order: id, the letters lesson they follow, their words.</summary>
    IReadOnlyList<AlphabetWordLesson> WordLessons { get; }
}

public record AlphabetWordLesson(int Id, int After, IReadOnlyList<AlphabetWord> Words);

public record AlphabetWord(string Word, string Translation);
