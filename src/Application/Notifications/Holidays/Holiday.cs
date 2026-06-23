namespace Application.Notifications.Holidays;

public record Holiday(
    string Key,
    string RussianName,
    string GeorgianName,
    string GeorgianPhrase,
    string Transliteration,
    string Translation);
