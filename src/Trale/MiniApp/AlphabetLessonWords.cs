using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Common.Interfaces.MiniApp;

namespace Trale.MiniApp;

/// <summary>
/// The alphabet words lessons from <c>Lessons/GeorgianAlphabetProgressive/words.json</c> (section
/// <c>wordLessons</c>, copied next to the binaries), read once.
/// </summary>
public class AlphabetLessonWords : IAlphabetLessonWords
{
    private readonly Lazy<IReadOnlyList<AlphabetWordLesson>> _lessons;

    public AlphabetLessonWords() : this(Path.Combine(AppContext.BaseDirectory, "Lessons", "GeorgianAlphabetProgressive", "words.json"))
    {
    }

    public AlphabetLessonWords(string path)
    {
        _lessons = new Lazy<IReadOnlyList<AlphabetWordLesson>>(() => Parse(File.ReadAllText(path)));
    }

    /// <summary>Читает words.json рядом с бинарниками — для каталога уроков (без DI).</summary>
    public static AlphabetLessonWords Default { get; } = new();

    public IReadOnlyList<AlphabetWordLesson> WordLessons => _lessons.Value;

    public IReadOnlyList<AlphabetWord> WordsOf(int lessonId) =>
        _lessons.Value.FirstOrDefault(l => l.Id == lessonId)?.Words ?? Array.Empty<AlphabetWord>();

    public static IReadOnlyList<AlphabetWordLesson> Parse(string json)
    {
        var file = JsonSerializer.Deserialize<WordsFile>(json) ?? throw new InvalidOperationException("words.json is empty");
        return file.WordLessons
            .Select(l => new AlphabetWordLesson(l.Id, l.After, l.Words.Select(w => new AlphabetWord(w.Word, w.Translation)).ToList()))
            .ToList();
    }

    private sealed class WordsFile
    {
        [JsonPropertyName("wordLessons")] public List<WordLesson> WordLessons { get; set; } = [];
    }

    private sealed class WordLesson
    {
        [JsonPropertyName("id")] public int Id { get; set; }
        [JsonPropertyName("after")] public int After { get; set; }
        [JsonPropertyName("words")] public List<WordItem> Words { get; set; } = [];
    }

    private sealed class WordItem
    {
        [JsonPropertyName("word")] public string Word { get; set; } = "";
        [JsonPropertyName("translation")] public string Translation { get; set; } = "";
    }
}
