using System.Collections.Generic;

namespace Application.Common.Interfaces.MiniApp;

public interface IMiniAppContentProvider
{
    List<StarterWordDto> GetStarterVocabulary();

    /// <summary>Lessons of a module in the order the mini-app shows them — in the alphabet the words lessons
    /// (ids 12+) sit between the letters lessons, so ids are not the order. Empty — no such module.</summary>
    IReadOnlyList<LessonOutline> LessonOrder(string moduleId);

    /// <summary>The module's title as the mini-app shows it; null — no such module.</summary>
    string? ModuleTitle(string moduleId);
}

/// <summary>A lesson for a message to a learner: its title and what it gives. Georgian words in both already
/// carry their Cyrillic reading in brackets — «და (да)».</summary>
public record LessonOutline(int Id, string Title, string Goal);

public class StarterWordDto
{
    public string Word { get; set; }
    public string Definition { get; set; }
    public string Example { get; set; }
    public string? AudioUrl { get; set; }

    public StarterWordDto() { }

    public StarterWordDto(string word, string definition, string example, string? audioUrl = null)
    {
        Word = word;
        Definition = definition;
        Example = example;
        AudioUrl = audioUrl;
    }
}
