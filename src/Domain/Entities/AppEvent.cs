// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// One moment of a person in the mini-app outside a lesson: the app opened (its script started), loaded (the
/// first screen got its data) or failed to load, a screen shown, the paywall opened, the app hidden. Written by
/// the mini-app in small batches (<c>POST /api/miniapp/app-events</c>) so it shows who opened the app and left
/// before it loaded, and where people go once it did (<c>docs/analytics/app-funnel.sql</c>). Lesson steps live
/// in <see cref="LessonEvent"/>. Nothing about the person beyond <see cref="UserId"/>.
/// </summary>
public class AppEvent
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    /// <summary>What happened (server whitelist): <c>app_open</c>, <c>app_ready</c>, <c>screen</c>…</summary>
    public required string Event { get; set; }

    /// <summary>For <c>screen</c> and <c>app_hide</c> — the screen (<c>dashboard</c>, <c>verbs</c>…); for <c>paywall</c> — what opened it.</summary>
    public string? Target { get; set; }

    /// <summary>
    /// Milliseconds since the page started loading for <c>app_open</c>, <c>app_ready</c>, <c>app_error</c>;
    /// seconds the app was open for <c>app_hide</c>.
    /// </summary>
    public int? Value { get; set; }

    /// <summary>Telegram client, as <c>Telegram.WebApp.platform</c> says: <c>ios</c>, <c>android</c>, <c>tdesktop</c>…</summary>
    public string? Platform { get; set; }

    /// <summary>The <c>startapp</c> parameter of the link the app was opened by, if any.</summary>
    public string? StartParam { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}
