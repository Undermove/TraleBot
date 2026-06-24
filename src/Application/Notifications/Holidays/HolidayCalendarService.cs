using Application.Common.Interfaces;

namespace Application.Notifications.Holidays;

/// <summary>
/// V1 Georgian holiday catalog (see design-specs/82-holiday-calendar.md): 9 fixed
/// dates + movable Julian Easter. Stateless lookup — callers compute the Tbilisi
/// (UTC+4) date and ask whether that day is a holiday.
/// </summary>
public class HolidayCalendarService : IHolidayCalendarService
{
    private static readonly IReadOnlyDictionary<(int Month, int Day), Holiday> FixedHolidays =
        new Dictionary<(int, int), Holiday>
        {
            [(1, 1)] = new(
                "new-year",
                "Новый год",
                "ახალი წელი",
                "გილოცავ ახალ წელს!",
                "Гилоцав ахал цэлс!",
                "Поздравляю с Новым годом!"),
            [(1, 7)] = new(
                "christmas",
                "Рождество Христово",
                "ქრისტეს შობა",
                "გილოცავ შობას!",
                "Гилоцав Шобас!",
                "Поздравляю с Рождеством!"),
            [(1, 19)] = new(
                "epiphany",
                "Крещение Господне",
                "ნათლისღება",
                "ნათლისღება გილოცავ!",
                "Натлисгхеба гилоцав!",
                "Поздравляю с Крещением!"),
            [(4, 14)] = new(
                "language-day",
                "День грузинского языка",
                "ქართული ენის დღე",
                "დედა ენის დღე გილოცავ!",
                "Дэда энис дгэ гилоцав!",
                "Поздравляю с Днём родного языка!"),
            [(5, 26)] = new(
                "independence",
                "День независимости Грузии",
                "დამოუკიდებლობის დღე",
                "დამოუკიდებლობის დღე გილოცავ!",
                "Дамоукидеблобис дгэ гилоцав!",
                "Поздравляю с Днём независимости!"),
            [(8, 28)] = new(
                "mariamoba",
                "Мариамоба",
                "მარიამობა",
                "მარიამობა გილოცავ!",
                "Мариамоба гилоцав!",
                "Поздравляю с Мариамоба!"),
            [(10, 14)] = new(
                "svetitskhovloba",
                "Светицховлоба",
                "სვეტიცხოვლობა",
                "სვეტიცხოვლობა გილოცავ!",
                "Свэтицховлоба гилоцав!",
                "Поздравляю со Светицховлоба!"),
            [(11, 4)] = new(
                "tbilisoba",
                "Тбилисоба",
                "თბილისობა",
                "თბილისობა გილოცავ!",
                "Тбилисоба гилоцав!",
                "Поздравляю с Тбилисоба!"),
            [(11, 23)] = new(
                "giorgoba",
                "Гиоргоба",
                "გიორგობა",
                "გიორგობა გილოცავ!",
                "Гиоргоба гилоцав!",
                "Поздравляю с Гиоргоба!"),
        };

    // Spec §4: never "გილოცავ აღდგომას" — only the traditional paschal greeting.
    private static readonly Holiday Easter = new(
        "easter",
        "Пасха",
        "აღდგომა",
        "ქრისტე აღდგა!",
        "Кристэ агдга!",
        "Христос Воскресе!");

    public Holiday? GetHolidayFor(DateOnly tbilisiDate)
    {
        if (FixedHolidays.TryGetValue((tbilisiDate.Month, tbilisiDate.Day), out var fixedHoliday))
            return fixedHoliday;

        if (tbilisiDate == JulianEaster.For(tbilisiDate.Year))
            return Easter;

        return null;
    }
}
