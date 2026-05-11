namespace Application.Notifications;

public class HolidayCalendarService
{
    private static readonly IReadOnlyList<(int Month, int Day, HolidayInfo Info)> FixedHolidays =
    [
        (1, 7, new HolidayInfo(
            NameRu: "Рождество Христово",
            NameKa: "შობა",
            GreetingKa: "გილოცავ შობას!",
            Transliteration: "Гилоцав шобас!",
            TranslationRu: "Поздравляю с Рождеством!"
        )),
        (4, 14, new HolidayInfo(
            NameRu: "День грузинского языка (Деда-эна)",
            NameKa: "დედა-ენის დღე",
            GreetingKa: "ქართული ენის დღე გილოცავთ!",
            Transliteration: "Картули энис дге гилоцавт!",
            TranslationRu: "Поздравляем с Днём грузинского языка!"
        )),
        (5, 5, new HolidayInfo(
            NameRu: "День Бомборы",
            NameKa: "ბომბორის დღე",
            GreetingKa: "ბომბორა გილოცავს!",
            Transliteration: "Бомбора гилоцавс!",
            TranslationRu: "Бомбора поздравляет!"
        )),
        (5, 26, new HolidayInfo(
            NameRu: "День независимости Грузии",
            NameKa: "დამოუკიდებლობის დღე",
            GreetingKa: "გამარჯობა, საქართველო!",
            Transliteration: "Гамарджоба, Сакартвело!",
            TranslationRu: "Здравствуй, Грузия!"
        )),
        (8, 28, new HolidayInfo(
            NameRu: "Мариамоба (Успение Богородицы)",
            NameKa: "მარიამობა",
            GreetingKa: "გილოცავ მარიამობას!",
            Transliteration: "Гилоцав Мариамобас!",
            TranslationRu: "Поздравляю с Мариамоба!"
        )),
        (11, 4, new HolidayInfo(
            NameRu: "Тбилисоба (День города Тбилиси)",
            NameKa: "თბილისობა",
            GreetingKa: "გილოცავ თბილისობას!",
            Transliteration: "Гилоцав Тбилисобас!",
            TranslationRu: "Поздравляю с Тбилисоба!"
        )),
        (11, 23, new HolidayInfo(
            NameRu: "Гиоргоба (День святого Георгия)",
            NameKa: "გიორგობა",
            GreetingKa: "გილოცავ გიორგობას!",
            Transliteration: "Гилоцав Гиоргобас!",
            TranslationRu: "Поздравляю с Гиоргоба!"
        )),
    ];

    private static readonly HolidayInfo EasterInfo = new HolidayInfo(
        NameRu: "Пасха (Светлое Воскресение)",
        NameKa: "აღდგომა",
        GreetingKa: "ქრისტე აღდგა!",
        Transliteration: "Кристе агдга!",
        TranslationRu: "Христос воскресе!"
    );

    public HolidayInfo? GetTodayHoliday(DateOnly today)
    {
        foreach (var (month, day, info) in FixedHolidays)
        {
            if (today.Month == month && today.Day == day)
                return info;
        }

        var easter = ComputeJulianEasterGregorian(today.Year);
        if (today == easter)
            return EasterInfo;

        return null;
    }

    // Julian Easter algorithm (Meeus/Jones/Butcher for Julian calendar).
    // Returns the Gregorian-calendar date of Orthodox Easter for the given year.
    // In the 20th-21st centuries Julian calendar trails Gregorian by 13 days.
    private static DateOnly ComputeJulianEasterGregorian(int year)
    {
        int a = year % 4;
        int b = year % 7;
        int c = year % 19;
        int d = (19 * c + 15) % 30;
        int e = (2 * a + 4 * b - d + 34) % 7;
        int f = d + e + 114;
        int julianMonth = f / 31;
        int julianDay = (f % 31) + 1;

        // Convert Julian date to DateOnly, then add 13 days for Gregorian equivalent
        var julian = new DateOnly(year, julianMonth, julianDay);
        return julian.AddDays(13);
    }
}
