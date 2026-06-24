using System.Globalization;

namespace Application.Notifications.Holidays;

/// <summary>
/// Meeus's Julian algorithm for the date of Pascha on the Julian calendar,
/// returned as the corresponding Gregorian <see cref="DateOnly"/>. Georgian
/// Orthodox Easter follows the Julian computus — Gregorian/Western Easter is
/// explicitly disallowed for the holiday push (spec §4: режет ухо носителю).
/// </summary>
public static class JulianEaster
{
    public static DateOnly For(int year)
    {
        var a = year % 4;
        var b = year % 7;
        var c = year % 19;
        var d = (19 * c + 15) % 30;
        var e = (2 * a + 4 * b - d + 34) % 7;
        var julianMonth = (d + e + 114) / 31;
        var julianDay = ((d + e + 114) % 31) + 1;

        var gregorian = new DateTime(year, julianMonth, julianDay, new JulianCalendar());
        return DateOnly.FromDateTime(gregorian);
    }
}
