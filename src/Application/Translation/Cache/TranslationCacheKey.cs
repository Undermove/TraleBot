using System.Text;

namespace Application.Translation.Cache;

/// <summary>
/// Normalises a looked-up word or phrase into the key of the translation cache, so that
/// "Привет", " привет " and "привет!" are one entry.
/// </summary>
public static class TranslationCacheKey
{
    /// <summary>Column length of <c>TranslationCacheEntry.Key</c>; anything longer is not a dictionary lookup.</summary>
    public const int MaxLength = 128;

    /// <summary>The key, or null when the text has nothing to look up or is too long to cache.</summary>
    public static string? Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var builder = new StringBuilder(text.Length);
        var pendingSpace = false;
        // NFC first: a letter typed as base + combining mark must equal the precomposed one.
        foreach (var c in text.Normalize(NormalizationForm.FormC).ToLowerInvariant())
        {
            if (char.IsWhiteSpace(c))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                builder.Append(' ');
                pendingSpace = false;
            }

            // «ё» is typed as «е» more often than not; one word must not become two entries.
            builder.Append(c == 'ё' ? 'е' : c);
        }

        // Quotes, brackets and sentence punctuation around the text are not part of the word;
        // punctuation inside it (a hyphen, an apostrophe) is.
        var key = builder.ToString().TrimEdges(c => char.IsPunctuation(c) || char.IsSymbol(c) || c == ' ');
        return key.Length is 0 or > MaxLength ? null : key;
    }

    private static string TrimEdges(this string value, Func<char, bool> isEdge)
    {
        var start = 0;
        var end = value.Length;
        while (start < end && isEdge(value[start])) start++;
        while (end > start && isEdge(value[end - 1])) end--;
        return value[start..end];
    }
}
