using Application.Notifications.Holidays;

namespace Application.Common.Interfaces;

/// <summary>
/// Source of truth for "what Georgian holiday is today?" — pure, side-effect-free
/// lookup against the V1 catalog in design-specs/82-holiday-calendar.md.
/// Consumed by the holiday push dispatcher (epic #894 / task #2).
/// </summary>
public interface IHolidayCalendarService
{
    Holiday? GetHolidayFor(DateOnly tbilisiDate);

    /// <summary>Every holiday in the catalog (fixed dates + Easter) — for admin test/preview.</summary>
    IReadOnlyList<Holiday> AllHolidays();
}
