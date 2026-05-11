using Application.Notifications;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Notifications;

public class HolidayCalendarServiceDiTests : TestBase
{
    [Test]
    public void HolidayCalendarService_IsRegisteredAsSingleton_ReturnsSameInstanceTwice()
    {
        var instance1 = _testServer.Services.GetRequiredService<HolidayCalendarService>();
        var instance2 = _testServer.Services.GetRequiredService<HolidayCalendarService>();

        instance1.Should().BeSameAs(instance2);
    }
}
