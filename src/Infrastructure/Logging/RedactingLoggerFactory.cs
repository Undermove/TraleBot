using System.Collections;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Logging;

/// <summary>
/// Sits between the application and every log provider (console, anything added later): message,
/// structured values, scopes and exception text pass through <see cref="SecretRedactor"/> before a
/// provider sees them. It does not depend on log levels or on which provider is configured.
/// </summary>
public sealed class RedactingLoggerFactory(ILoggerFactory inner, SecretRedactor redactor) : ILoggerFactory
{
    private readonly ConcurrentDictionary<string, ILogger> _loggers = new(StringComparer.Ordinal);

    public ILogger CreateLogger(string categoryName) =>
        _loggers.GetOrAdd(categoryName, name => new RedactingLogger(inner.CreateLogger(name), redactor));

    public void AddProvider(ILoggerProvider provider) => inner.AddProvider(provider);

    public void Dispose() => inner.Dispose();

    private sealed class RedactingLogger(ILogger inner, SecretRedactor redactor) : ILogger
    {
        public bool IsEnabled(LogLevel logLevel) => inner.IsEnabled(logLevel);

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!inner.IsEnabled(logLevel))
            {
                return;
            }

            // Rendered once here; the providers get the finished (masked) text and the masked values.
            var message = redactor.Redact(formatter(state, exception));
            var values = state as IReadOnlyList<KeyValuePair<string, object?>>;
            var record = new RedactedState(message, values == null ? [] : Redact(values));

            inner.Log(logLevel, eventId, record, redactor.RedactException(exception), static (s, _) => s.Message);
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            switch (state)
            {
                case string text:
                    return inner.BeginScope(redactor.Redact(text));
                case IEnumerable<KeyValuePair<string, object?>> pairs:
                {
                    var values = pairs as IReadOnlyList<KeyValuePair<string, object?>> ?? pairs.ToList();
                    var clean = Redact(values);
                    var rendered = state.ToString();
                    var cleanRendered = redactor.Redact(rendered);
                    return ReferenceEquals(clean, values) && ReferenceEquals(rendered, cleanRendered)
                        ? inner.BeginScope(state)
                        : inner.BeginScope(new RedactedState(cleanRendered ?? "", clean));
                }
                default:
                {
                    var rendered = state.ToString();
                    var cleanRendered = redactor.Redact(rendered);
                    return ReferenceEquals(rendered, cleanRendered)
                        ? inner.BeginScope(state)
                        : inner.BeginScope(cleanRendered!);
                }
            }
        }

        /// <summary>The same list when every value is clean.</summary>
        private IReadOnlyList<KeyValuePair<string, object?>> Redact(IReadOnlyList<KeyValuePair<string, object?>> values)
        {
            KeyValuePair<string, object?>[]? copy = null;
            for (var i = 0; i < values.Count; i++)
            {
                var pair = values[i];
                var clean = redactor.RedactValue(pair.Value);
                if (ReferenceEquals(clean, pair.Value))
                {
                    continue;
                }

                copy ??= values.ToArray();
                copy[i] = new KeyValuePair<string, object?>(pair.Key, clean);
            }

            return copy ?? values;
        }
    }

    /// <summary>A log record (or scope) as the providers get it: finished text plus the structured values.</summary>
    private sealed class RedactedState(string message, IReadOnlyList<KeyValuePair<string, object?>> values)
        : IReadOnlyList<KeyValuePair<string, object?>>
    {
        public string Message => message;

        public int Count => values.Count;

        public KeyValuePair<string, object?> this[int index] => values[index];

        public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => values.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public override string ToString() => message;
    }
}
