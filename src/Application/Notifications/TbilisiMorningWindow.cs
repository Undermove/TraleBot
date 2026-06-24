namespace Application.Notifications;

/// <summary>
/// Holiday pushes fire only at 09:xx Tbilisi time — one window per calendar day.
/// The hourly worker ticks every hour, so every dispatcher needs its own time-of-day
/// guard; this is the holiday one. Tbilisi is fixed UTC+4 (no DST), so we compare
/// the UTC hour against the offset directly instead of pulling in
/// <see cref="TimeZoneInfo"/> (which would need the IANA DB in the container).
/// </summary>
public static class TbilisiMorningWindow
{
    public const int TbilisiOffsetHours = 4;
    public const int MorningPushHourTbilisi = 9;
    public const int MorningPushHourUtc = MorningPushHourTbilisi - TbilisiOffsetHours; // 5

    /// <summary>
    /// True when <paramref name="utc"/> falls inside the 09:00–09:59 Tbilisi window
    /// (i.e. 05:00–05:59 UTC). The minute/second are intentionally ignored —
    /// the worker ticks at top-of-hour and the holiday dispatcher gets one shot.
    /// </summary>
    public static bool IsHolidayPushHour(DateTime utc) => utc.Hour == MorningPushHourUtc;
}
