using Hangfire.Logging;
using Microsoft.Extensions.Logging;
using LogLevel = Hangfire.Logging.LogLevel;

namespace Infrastructure.BackgroundJobs;

/// <summary>
/// Hangfire's log output, sent to the host's loggers. Hangfire keeps one log provider for the whole
/// process, and asks it for loggers at any time — also after the host that registered it is gone
/// (the last moments of a shutdown; a test process that starts several hosts). Its own adapter throws
/// then, and the exception surfaces wherever Hangfire happened to want a logger: queueing a job,
/// a worker picking one up. This one goes quiet instead.
/// </summary>
internal sealed class HostLogProvider(ILoggerFactory loggers) : ILogProvider
{
    public ILog GetLogger(string name)
    {
        try
        {
            return new HostLog(loggers.CreateLogger(name));
        }
        catch (ObjectDisposedException)
        {
            return Silent.Instance;
        }
    }

    private sealed class HostLog(ILogger logger) : ILog
    {
        public bool Log(LogLevel logLevel, Func<string>? messageFunc, Exception? exception = null)
        {
            var level = logLevel switch
            {
                LogLevel.Trace => Microsoft.Extensions.Logging.LogLevel.Trace,
                LogLevel.Debug => Microsoft.Extensions.Logging.LogLevel.Debug,
                LogLevel.Info => Microsoft.Extensions.Logging.LogLevel.Information,
                LogLevel.Warn => Microsoft.Extensions.Logging.LogLevel.Warning,
                LogLevel.Error => Microsoft.Extensions.Logging.LogLevel.Error,
                _ => Microsoft.Extensions.Logging.LogLevel.Critical
            };

            // Hangfire's convention: no message = "is this level on?".
            if (messageFunc == null)
            {
                return logger.IsEnabled(level);
            }

            try
            {
                logger.Log(level, 0, messageFunc, exception, static (message, _) => message());
            }
            catch (ObjectDisposedException)
            {
                // The host is gone; so is the reader of its log.
            }

            return true;
        }
    }

    private sealed class Silent : ILog
    {
        public static readonly Silent Instance = new();

        public bool Log(LogLevel logLevel, Func<string>? messageFunc, Exception? exception = null) => false;
    }
}
