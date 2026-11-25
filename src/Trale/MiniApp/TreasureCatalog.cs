using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Application.DailyTask;

namespace Trale.MiniApp;

/// <summary>Reads <c>Lessons/Treasures/treasures.json</c> once.</summary>
public class TreasureCatalog : ITreasureCatalog
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly Lazy<(IReadOnlyList<TreasureWord> Words, IReadOnlyList<TreasureCard> Cards)> _data;

    public TreasureCatalog() : this(Path.Combine(AppContext.BaseDirectory, "Lessons", "Treasures", "treasures.json")) { }

    public TreasureCatalog(string path)
    {
        _data = new(() =>
        {
            if (!File.Exists(path)) return ([], []);
            var file = JsonSerializer.Deserialize<FileShape>(File.ReadAllText(path), Json);
            return (file?.Words ?? [], file?.Cards ?? []);
        });
    }

    public IReadOnlyList<TreasureWord> Words => _data.Value.Words;
    public IReadOnlyList<TreasureCard> Cards => _data.Value.Cards;

    private sealed class FileShape
    {
        public List<TreasureWord>? Words { get; set; }
        public List<TreasureCard>? Cards { get; set; }
    }
}
