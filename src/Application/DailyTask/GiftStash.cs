using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Application.DailyTask;

/// <summary>
/// What the gift of the day has given a learner to keep: hints for the exercises, treasure words, postcards,
/// things for Bombora (worn: one per slot) and furniture for Bombora's house. Stored as JSON on the progress row.
/// </summary>
public class GiftStash
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public int Hints { get; set; }
    public List<string> Words { get; set; } = [];
    public List<string> Cards { get; set; } = [];
    public List<string> Items { get; set; } = [];
    public List<string> Furniture { get; set; } = [];
    /// <summary>slot → item id that Bombora wears.</summary>
    public Dictionary<string, string> Wear { get; set; } = [];

    public static GiftStash Read(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new GiftStash();
        try
        {
            return JsonSerializer.Deserialize<GiftStash>(json, Json) ?? new GiftStash();
        }
        catch (JsonException)
        {
            return new GiftStash();
        }
    }

    public string Write() => JsonSerializer.Serialize(this, Json);
}

/// <summary>
/// What can be collected besides words and postcards (<see cref="ITreasureCatalog"/>). Ids are shared with the
/// mini-app: miniapp-src/src/today/collection.ts draws them.
/// </summary>
public static class GiftCatalog
{
    public record Item(string Id, string Slot, bool Golden);

    /// <summary>Things for Bombora: a head, eyes and neck slot. Golden ones come only from the golden chest.</summary>
    public static readonly Item[] Items =
    [
        new("beret", "head", false),
        new("cap", "head", false),
        new("wreath", "head", false),
        new("crown", "head", true),
        new("round-glasses", "eyes", false),
        new("sunglasses", "eyes", false),
        new("star-glasses", "eyes", true),
        new("scarf-navy", "neck", false),
        new("scarf-gold", "neck", false),
        new("scarf-kilim", "neck", true),
        new("bow-tie", "neck", false)
    ];

    /// <summary>Furniture for Bombora's house.</summary>
    public static readonly string[] Furniture = ["bowl", "rug", "pillow", "lamp", "plant", "shelf", "picture", "clock"];

    public static string[] Slots => Items.Select(i => i.Slot).Distinct().ToArray();
}
