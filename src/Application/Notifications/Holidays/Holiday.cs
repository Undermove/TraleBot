namespace Application.Notifications.Holidays;

public record Holiday(
    string Key,
    string RussianName,
    string GeorgianName,
    string GeorgianPhrase,
    string Transliteration,
    string Translation,
    // Mini-post fields (see BuildHolidayPushText). Defaulted so older 6-arg
    // constructions (tests) still compile; the real catalog fills them in.
    string Emoji = "🎉",
    string Title = "",
    string Fact = "");
