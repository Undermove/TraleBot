using Application.Common.Extensions;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class LanguageDetectionExtensionsTests
{
    [TestCase("Hello World", Language.English)]
    [TestCase("американский лось", Language.Russian)]
    [TestCase("машина", Language.Russian)]
    [TestCase("საზამთრო", Language.Georgian)]
    public void ShouldDetectEnglishLanguage(string input, Language expected)
    {
        Language result = input.DetectLanguage();
        result.ShouldBe(expected);
    }
}