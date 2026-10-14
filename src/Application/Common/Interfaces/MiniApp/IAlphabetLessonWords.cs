namespace Application.Common.Interfaces.MiniApp;

/// <summary>
/// The base vocabulary of the alphabet lessons (<c>alphabet-progressive</c>): the Georgian words each lesson
/// teaches with their Russian translation, as the lesson theory gives them. The server's own list — what
/// goes into a learner's dictionary after a lesson is never taken from the client.
/// </summary>
public interface IAlphabetLessonWords
{
    /// <summary>The words of one lesson (1-based); empty for an unknown lesson.</summary>
    IReadOnlyList<AlphabetWord> WordsOf(int lessonId);
}

public record AlphabetWord(string Word, string Translation);
