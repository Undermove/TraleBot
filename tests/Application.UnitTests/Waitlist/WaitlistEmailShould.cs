using Application.Waitlist;
using Shouldly;

namespace Application.UnitTests.Waitlist;

public class WaitlistEmailShould
{
    [TestCase("you@example.com", "you@example.com")]
    [TestCase("  You@Example.COM ", "you@example.com")]
    [TestCase("first.last+tag@mail.example.org", "first.last+tag@mail.example.org")]
    public void BeTrimmedAndLowerCased(string typed, string expected) =>
        JoinWaitlistService.NormalizeEmail(typed).ShouldBe(expected);

    [TestCase(null)]
    [TestCase("")]
    [TestCase("not an address")]
    [TestCase("you@")]
    [TestCase("@example.com")]
    [TestCase("you@localhost")]
    [TestCase("you@example.")]
    [TestCase("you @example.com")]
    [TestCase("Name <you@example.com>")]
    public void BeRefusedWhenItIsNotAnAddress(string? typed) =>
        JoinWaitlistService.NormalizeEmail(typed).ShouldBeNull();

    [Test]
    public void BeRefusedWhenTooLong() =>
        JoinWaitlistService.NormalizeEmail(new string('a', 250) + "@example.com").ShouldBeNull();
}
