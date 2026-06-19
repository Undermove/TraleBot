using NUnit.Framework;
using Shouldly;
using Trale.Services;

namespace Infrastructure.UnitTests.MiniApp;

[TestFixture]
public class TelegramInitDataStartParamTests
{
    [Test]
    public void Extracts_start_param_from_init_data()
    {
        const string initData = "auth_date=123&start_param=site&user=%7B%22id%22%3A1%7D&hash=abc";
        TelegramInitDataValidator.TryGetStartParam(initData).ShouldBe("site");
    }

    [Test]
    public void Returns_null_when_no_start_param()
    {
        const string initData = "auth_date=123&user=%7B%22id%22%3A1%7D&hash=abc";
        TelegramInitDataValidator.TryGetStartParam(initData).ShouldBeNull();
    }

    [Test]
    public void Returns_null_for_empty_init_data()
    {
        TelegramInitDataValidator.TryGetStartParam("").ShouldBeNull();
    }
}
