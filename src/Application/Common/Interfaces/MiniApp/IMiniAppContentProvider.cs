using System.Collections.Generic;

namespace Application.Common.Interfaces.MiniApp;

public interface IMiniAppContentProvider
{
    List<StarterWordDto> GetStarterVocabulary();
}

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
