using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Common.Interfaces.MiniApp;

namespace Trale.MiniApp;

/// <summary>
/// The alphabet lessons' base vocabulary from <c>Lessons/GeorgianAlphabetProgressive/words.json</c>
/// (copied next to the binaries), read once.
/// </summary>
public class AlphabetLessonWords : IAlphabetLessonWords
{
    private readonly Lazy<Dictionary<int, IReadOnlyList<AlphabetWord>>> _lessons;

    public AlphabetLessonWords() : this(Path.Combine(AppContext.BaseDirectory, "Lessons", "GeorgianAlphabetProgressive", "words.json"))
    {
    }

    public AlphabetLessonWords(string path)
    {
        _lessons = new Lazy<Dictionary<int, IReadOnlyList<AlphabetWord>>>(() => Parse(File.ReadAllText(path)));
    }

    public IReadOnlyList<AlphabetWord> WordsOf(int lessonId) =>
        _lessons.Value.TryGetValue(lessonId, out var words) ? words : Array.Empty<AlphabetWord>();

    public static Dictionary<int, IReadOnlyList<AlphabetWord>> Parse(string json)
    {
        var file = JsonSerializer.Deserialize<WordsFile>(json) ?? throw new InvalidOperationException("words.json is empty");
        return file.Lessons.ToDictionary(
            l => l.Lesson,
            l => (IReadOnlyList<AlphabetWord>)l.Words.Select(w => new AlphabetWord(w.Word, w.Translation)).ToList());
    }

    private sealed class WordsFile
    {
        [JsonPropertyName("lessons")] public List<LessonWords> Lessons { get; set; } = [];
    }

    private sealed class LessonWords
    {
        [JsonPropertyName("lesson")] public int Lesson { get; set; }
        [JsonPropertyName("words")] public List<WordItem> Words { get; set; } = [];
    }

    private sealed class WordItem
    {
        [JsonPropertyName("word")] public string Word { get; set; } = "";
        [JsonPropertyName("translation")] public string Translation { get; set; } = "";
    }
}
