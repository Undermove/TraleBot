using Application.Notifications;
using Shouldly;

namespace Application.UnitTests.Notifications;

[TestFixture]
public class HolidayCalendarServiceTests
{
    private HolidayCalendarService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new HolidayCalendarService();
    }

    // --- Fixed holidays ---

    [Test]
    public void GetTodayHoliday_ChristmasJan7_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 1, 7));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_MotherTongueApr14_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 4, 14));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_BomboraDayMay5_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 5, 5));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_IndependenceDayMay26_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 5, 26));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_MariamobaaAug28_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 8, 28));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_TbilisobaNov4_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 11, 4));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_GiorgobaNov23_ReturnsHolidayInfo()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 11, 23));

        result.ShouldNotBeNull();
    }

    // --- Julian Easter ---

    [Test]
    // QA plan stated "Julian Easter 2026 = May 2" which is incorrect.
    // Julian Easter 2026 Gregorian = April 12. May 2 is Julian Easter 2027.
    // This test verifies the intent: the Julian Easter algorithm computes correctly,
    // using 2027-05-02 (the actual May 2 Easter date) per the algorithm.
    public void GetTodayHoliday_JulianEaster2026_ReturnsMay2()
    {
        // Orthodox Easter 2027 = May 2 Gregorian (April 19 Julian + 13 days)
        var result = _sut.GetTodayHoliday(new DateOnly(2027, 5, 2));

        result.ShouldNotBeNull();
    }

    [Test]
    public void GetTodayHoliday_JulianEaster2027_ReturnsCorrectGregorianDate()
    {
        // Julian Easter 2027 = April 19 Julian = May 2 Gregorian
        var result = _sut.GetTodayHoliday(new DateOnly(2027, 5, 2));

        result.ShouldNotBeNull();
        result!.NameRu.ShouldContain("Пасх");
    }

    [Test]
    public void GetTodayHoliday_Easter_GreetingIsChristeAghdga()
    {
        // Julian Easter 2027 = May 2 Gregorian
        var result = _sut.GetTodayHoliday(new DateOnly(2027, 5, 2));

        result.ShouldNotBeNull();
        result!.GreetingKa.ShouldBe("ქრისტე აღდგა!");
    }

    // --- Required fields ---

    [TestCase(2026, 1, 7, "Christmas")]
    [TestCase(2026, 4, 14, "MotherTongue")]
    [TestCase(2026, 5, 5, "BomboraDay")]
    [TestCase(2026, 5, 26, "Independence")]
    [TestCase(2026, 8, 28, "Mariamoba")]
    [TestCase(2026, 11, 4, "Tbilisoba")]
    [TestCase(2026, 11, 23, "Giorgoba")]
    [TestCase(2027, 5, 2, "Easter")]
    public void GetTodayHoliday_AllFixedHolidays_HaveRequiredFields(int year, int month, int day, string label)
    {
        var result = _sut.GetTodayHoliday(new DateOnly(year, month, day));

        result.ShouldNotBeNull($"{label} should return a holiday");
        result!.NameRu.ShouldNotBeNullOrWhiteSpace($"{label} NameRu must not be empty");
        result.NameKa.ShouldNotBeNullOrWhiteSpace($"{label} NameKa must not be empty");
        result.GreetingKa.ShouldNotBeNullOrWhiteSpace($"{label} GreetingKa must not be empty");
        result.Transliteration.ShouldNotBeNullOrWhiteSpace($"{label} Transliteration must not be empty");
        result.TranslationRu.ShouldNotBeNullOrWhiteSpace($"{label} TranslationRu must not be empty");
    }

    // --- Negative cases ---

    [Test]
    public void GetTodayHoliday_OrdinaryDay_ReturnsNull()
    {
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 5, 12));

        result.ShouldBeNull();
    }

    [Test]
    public void GetTodayHoliday_WesternEasterDate_ReturnsNull()
    {
        // Western/Gregorian Easter 2026 = April 5; Julian Easter 2026 = April 12
        // Calling with April 5 should return null (algorithm uses Julian, not Gregorian)
        var result = _sut.GetTodayHoliday(new DateOnly(2026, 4, 5));

        result.ShouldBeNull();
    }
}
