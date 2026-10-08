using System.Collections;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace IntegrationTests.Logging;

/// <summary>
/// A log provider that keeps everything a provider can be handed: the rendered message, the state and
/// each of its structured values, the scopes around the record and the whole exception text. It sits
/// where the console provider sits, so what it sees is what any sink would see.
/// </summary>
public sealed class LogCapture : ILoggerProvider, ISupportExternalScope
{
    private readonly ConcurrentQueue<string> _lines = new();
    private IExternalScopeProvider _scopes = new LoggerExternalScopeProvider();

    /// <summary>Everything captured so far, one piece of text per entry.</summary>
    public IReadOnlyList<string> Lines => _lines.ToArray();

    /// <summary>Rendered messages only, as the console would print them.</summary>
    public IReadOnlyList<string> Messages => _lines.Where(l => l.StartsWith(MessagePrefix)).Select(l => l[MessagePrefix.Length..]).ToArray();

    private const string MessagePrefix = "message: ";

    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);

    public void SetScopeProvider(IExternalScopeProvider scopeProvider) => _scopes = scopeProvider;

    public void Dispose()
    {
    }

    private void Keep(string kind, object? value)
    {
        if (value == null)
        {
            return;
        }

        _lines.Enqueue($"{kind}{value}");
        if (value is IEnumerable<KeyValuePair<string, object?>> pairs)
        {
            foreach (var pair in pairs)
            {
                _lines.Enqueue($"{kind}{pair.Key}={Render(pair.Value)}");
            }
        }
    }

    private static string Render(object? value) =>
        value is IEnumerable items and not string
            ? string.Join(", ", items.Cast<object?>().Select(i => i?.ToString()))
            : value?.ToString() ?? "";

    private sealed class Logger(LogCapture capture, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => capture._scopes.Push(state);

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            capture._lines.Enqueue($"{MessagePrefix}[{logLevel}] {category}: {formatter(state, exception)}");
            capture.Keep("state: ", state);
            capture._scopes.ForEachScope((scope, self) => self.Keep("scope: ", scope), capture);

            for (var e = exception; e != null; e = e.InnerException)
            {
                capture.Keep("exception: ", e.ToString());
                capture.Keep("exception message: ", e.Message);
                foreach (DictionaryEntry entry in e.Data)
                {
                    capture.Keep("exception data: ", $"{entry.Key}={entry.Value}");
                }
            }
        }
    }
}
