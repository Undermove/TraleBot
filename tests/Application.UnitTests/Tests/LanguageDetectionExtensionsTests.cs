using Application.Common.Extensions;
using Shouldly;

namespace Application.UnitTests.Tests;

public class LanguageDetectionExtensionsTests
{
    [TestCase("Hello World", "English")]
    [TestCase("американский лось", "Russian")]
    [TestCase("машина", "Russian")]
    public void ShouldDetectEnglishLanguage(string input, string expected)
    {
        string result = input.DetectLanguage();
        result.ShouldBe(expected);
    }
}