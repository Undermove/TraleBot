using Application.Notifications.Holidays;
using Shouldly;

namespace Application.UnitTests.Notifications;

public class HolidayCalendarServiceTests
{
    private readonly HolidayCalendarService _sut = new();

    [Test]
    public void GetHolidayFor_NewYear_ReturnsAxaliCheliEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 1, 1));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("new-year");
        holiday.RussianName.ShouldBe("Новый год");
        holiday.GeorgianName.ShouldBe("ახალი წელი");
        holiday.GeorgianPhrase.ShouldBe("გილოცავ ახალ წელს!");
        holiday.Transliteration.ShouldBe("Гилоцав ахал цэлс!");
        holiday.Translation.ShouldBe("Поздравляю с Новым годом!");
    }

    [Test]
    public void GetHolidayFor_Christmas_ReturnsShobaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 1, 7));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("christmas");
        holiday.GeorgianName.ShouldBe("ქრისტეს შობა");
        holiday.GeorgianPhrase.ShouldBe("გილოცავ შობას!");
        holiday.Transliteration.ShouldBe("Гилоцав Шобас!");
        holiday.Translation.ShouldBe("Поздравляю с Рождеством!");
    }

    [Test]
    public void GetHolidayFor_Epiphany_ReturnsNatlisghebaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 1, 19));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("epiphany");
        holiday.GeorgianName.ShouldBe("ნათლისღება");
        holiday.GeorgianPhrase.ShouldBe("ნათლისღება გილოცავ!");
        holiday.Transliteration.ShouldBe("Натлисгхеба гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Крещением!");
    }

    [Test]
    public void GetHolidayFor_LanguageDay_ReturnsDedaEnaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 4, 14));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("language-day");
        holiday.GeorgianName.ShouldBe("ქართული ენის დღე");
        holiday.GeorgianPhrase.ShouldBe("დედა ენის დღე გილოცავ!");
        holiday.Transliteration.ShouldBe("Дэда энис дгэ гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Днём родного языка!");
    }

    [Test]
    public void GetHolidayFor_IndependenceDay_ReturnsDamoukideblobisEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 5, 26));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("independence");
        holiday.GeorgianName.ShouldBe("დამოუკიდებლობის დღე");
        holiday.GeorgianPhrase.ShouldBe("დამოუკიდებლობის დღე გილოცავ!");
        holiday.Transliteration.ShouldBe("Дамоукидеблобис дгэ гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Днём независимости!");
    }

    [Test]
    public void GetHolidayFor_Mariamoba_ReturnsMariamobaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 8, 28));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("mariamoba");
        holiday.GeorgianName.ShouldBe("მარიამობა");
        holiday.GeorgianPhrase.ShouldBe("მარიამობა გილოცავ!");
        holiday.Transliteration.ShouldBe("Мариамоба гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Мариамоба!");
    }

    [Test]
    public void GetHolidayFor_Svetitskhovloba_ReturnsSvetitskhovlobaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 10, 14));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("svetitskhovloba");
        holiday.GeorgianName.ShouldBe("სვეტიცხოვლობა");
        holiday.GeorgianPhrase.ShouldBe("სვეტიცხოვლობა გილოცავ!");
        holiday.Transliteration.ShouldBe("Свэтицховлоба гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю со Светицховлоба!");
    }

    [Test]
    public void GetHolidayFor_Tbilisoba_ReturnsTbilisobaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 11, 4));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("tbilisoba");
        holiday.GeorgianName.ShouldBe("თბილისობა");
        holiday.GeorgianPhrase.ShouldBe("თბილისობა გილოცავ!");
        holiday.Transliteration.ShouldBe("Тбилисоба гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Тбилисоба!");
    }

    [Test]
    public void GetHolidayFor_Giorgoba_ReturnsGiorgobaEntry()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 11, 23));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("giorgoba");
        holiday.GeorgianName.ShouldBe("გიორგობა");
        holiday.GeorgianPhrase.ShouldBe("გიორგობა გილოცავ!");
        holiday.Transliteration.ShouldBe("Гиоргоба гилоцав!");
        holiday.Translation.ShouldBe("Поздравляю с Гиоргоба!");
    }

    [Test]
    public void GetHolidayFor_Easter2026_ReturnsAgdgomaEntry()
    {
        // Julian Easter 2026 = April 12 (Gregorian). Uses traditional response, NOT გილოცავ form
        // (spec §4 — режет ухо носителю).
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 4, 12));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("easter");
        holiday.RussianName.ShouldBe("Пасха");
        holiday.GeorgianName.ShouldBe("აღდგომა");
        holiday.GeorgianPhrase.ShouldBe("ქრისტე აღდგა!");
        holiday.Transliteration.ShouldBe("Кристэ агдга!");
        holiday.Translation.ShouldBe("Христос Воскресе!");
    }

    [Test]
    public void GetHolidayFor_NonHolidayDay_ReturnsNull()
    {
        // 12 мая — random non-holiday day (spec acceptance criteria).
        var holiday = _sut.GetHolidayFor(new DateOnly(2026, 5, 12));

        holiday.ShouldBeNull();
    }

    [Test]
    public void GetHolidayFor_DayAfterFixedHoliday_ReturnsNull()
    {
        _sut.GetHolidayFor(new DateOnly(2026, 1, 2)).ShouldBeNull();
        _sut.GetHolidayFor(new DateOnly(2026, 1, 8)).ShouldBeNull();
        _sut.GetHolidayFor(new DateOnly(2026, 11, 24)).ShouldBeNull();
    }

    [Test]
    public void GetHolidayFor_Easter_OnlyMatchesJulianDateForThatYear()
    {
        // April 12 is Easter in 2026, but not 2024 or 2025.
        _sut.GetHolidayFor(new DateOnly(2024, 4, 12)).ShouldBeNull();
        _sut.GetHolidayFor(new DateOnly(2025, 4, 12)).ShouldBeNull();
    }

    [Test]
    public void GetHolidayFor_Easter2024_MatchesMay5()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2024, 5, 5));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("easter");
    }

    [Test]
    public void GetHolidayFor_Easter2025_MatchesApril20()
    {
        var holiday = _sut.GetHolidayFor(new DateOnly(2025, 4, 20));

        holiday.ShouldNotBeNull();
        holiday.Key.ShouldBe("easter");
    }
}

public class JulianEasterTests
{
    [Test]
    public void For_2024_ReturnsMay5()
    {
        // 5-week gap year: Western Easter was March 31, Julian Easter May 5 (35-day diff).
        JulianEaster.For(2024).ShouldBe(new DateOnly(2024, 5, 5));
    }

    [Test]
    public void For_2025_ReturnsApril20()
    {
        // Coincidence year: Western and Julian Easter both fall on April 20.
        JulianEaster.For(2025).ShouldBe(new DateOnly(2025, 4, 20));
    }

    [Test]
    public void For_2026_ReturnsApril12()
    {
        // Western Easter was April 5, Julian Easter April 12 (1-week diff).
        JulianEaster.For(2026).ShouldBe(new DateOnly(2026, 4, 12));
    }

    [Test]
    public void For_2017_ReturnsApril16()
    {
        // Another coincidence year: April 16 in both calendars.
        JulianEaster.For(2017).ShouldBe(new DateOnly(2017, 4, 16));
    }

    [Test]
    public void For_2027_ReturnsMay2()
    {
        // Sanity check across a fourth year — Pentecost 50 days before May 2.
        JulianEaster.For(2027).ShouldBe(new DateOnly(2027, 5, 2));
    }
}
