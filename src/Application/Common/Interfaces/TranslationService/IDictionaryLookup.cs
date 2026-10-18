namespace Application.Common.Interfaces.TranslationService;

/// <summary>What a dictionary site has for a text — the second opinion on a model's translation.</summary>
/// <param name="Known">The site has a page for the text: it is a real word or phrase.</param>
/// <param name="Translations">Every translation the page lists, in the site's order; may be empty on a known page.</param>
public record DictionaryEntry(bool Known, IReadOnlyList<string> Translations)
{
    public static readonly DictionaryEntry Unknown = new(false, []);
}

public interface IDictionaryLookup
{
    /// <summary>The dictionary's page for a Russian or Georgian text (the other language is the target). Throws when the site is unreachable.</summary>
    Task<DictionaryEntry> LookupAsync(string text, CancellationToken ct);

    /// <summary>A sentence with the pair from the dictionary («source — translation»), or empty. Never throws.</summary>
    Task<string> ExampleAsync(string text, string translation, CancellationToken ct);
}
