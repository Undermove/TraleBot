using System.Collections;

namespace Infrastructure.Logging;

/// <summary>
/// Replaces configured secret values with <c>[redacted:name]</c>. Plain search over a short list —
/// no regular expressions, nothing allocated when the text is clean. Letter case is ignored, so a
/// token that arrives in another case (a mistyped webhook URL) is masked too.
/// </summary>
public sealed class SecretRedactor(IReadOnlyList<LogSecret> secrets)
{
    private readonly (string Value, string Mask)[] _secrets =
        secrets.Select(s => (s.Value, $"[redacted:{s.Name}]")).ToArray();

    public bool HasSecrets => _secrets.Length > 0;

    /// <summary>The same instance when there is nothing to mask.</summary>
    [return: System.Diagnostics.CodeAnalysis.NotNullIfNotNull(nameof(text))]
    public string? Redact(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        foreach (var (value, mask) in _secrets)
        {
            if (text.Contains(value, StringComparison.OrdinalIgnoreCase))
            {
                text = text.Replace(value, mask, StringComparison.OrdinalIgnoreCase);
            }
        }

        return text;
    }

    /// <summary>
    /// A value of a structured log record. Returned as it is when clean; otherwise replaced by its
    /// masked text (a <see cref="Uri"/> with a token in it becomes a string).
    /// </summary>
    public object? RedactValue(object? value)
    {
        switch (value)
        {
            case null:
                return null;
            case string text:
                return Redact(text);
            case IConvertible or Guid or DateTimeOffset or TimeSpan:
                // Numbers, booleans, dates, enums: nothing a secret could hide in.
                return value;
            case IEnumerable items:
                return RedactItems(items);
        }

        var rendered = value.ToString();
        var clean = Redact(rendered);
        return ReferenceEquals(rendered, clean) ? value : clean;
    }

    /// <summary>A list is rendered item by item by the log formatter, so it is checked the same way.</summary>
    private object RedactItems(IEnumerable items)
    {
        List<string?>? rendered = null;
        var dirty = false;
        foreach (var item in items)
        {
            var text = item?.ToString();
            var clean = Redact(text);
            dirty |= !ReferenceEquals(text, clean);
            (rendered ??= []).Add(clean);
        }

        return dirty ? string.Join(", ", rendered!) : items;
    }

    /// <summary>The same exception when its full text is clean; otherwise a stand-in that carries the masked text.</summary>
    [return: System.Diagnostics.CodeAnalysis.NotNullIfNotNull(nameof(exception))]
    public Exception? RedactException(Exception? exception)
    {
        if (exception == null)
        {
            return null;
        }

        var text = exception.ToString();
        var clean = Redact(text);
        return ReferenceEquals(text, clean)
            ? exception
            : new RedactedException(Redact(exception.Message), clean);
    }
}

/// <summary>
/// Stands in for an exception whose text carried a secret: the same text a sink would have printed
/// (type, message, inner exceptions, stack), masked. The original object does not reach the sinks.
/// </summary>
public sealed class RedactedException(string message, string fullText) : Exception(message)
{
    public override string? StackTrace => null;

    public override string ToString() => fullText;
}
