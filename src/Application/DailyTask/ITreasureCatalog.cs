using System.Collections.Generic;

namespace Application.DailyTask;

/// <summary>A treasure word: a rare or culturally loaded Georgian word with a tiny story.</summary>
public record TreasureWord(string Id, string Ka, string Tr, string Ru, string Story);

/// <summary>A postcard: a short Georgian phrase to send to a friend.</summary>
public record TreasureCard(string Id, string Ka, string Tr, string Ru, string When);

/// <summary>Words and postcards of the gift of the day (Lessons/Treasures/treasures.json, every form with a source).</summary>
public interface ITreasureCatalog
{
    IReadOnlyList<TreasureWord> Words { get; }
    IReadOnlyList<TreasureCard> Cards { get; }
}
