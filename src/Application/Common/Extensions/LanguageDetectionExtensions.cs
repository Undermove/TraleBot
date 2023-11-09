using System.Text.RegularExpressions;
using Domain.Entities;

namespace Application.Common.Extensions;

public static class LanguageDetectionExtensions
{
    public static Language DetectLanguage(this string input)
    {
        string russianPattern = @"[\p{IsCyrillic}]";
        string georgianPattern = @"[\u10D0-\u10FF]";
        
        bool containsRussian = Regex.IsMatch(input, russianPattern);
        bool containsGeorgian = Regex.IsMatch(input, georgianPattern);

        if (containsRussian)
        {
            return Language.Russian;
        }

        if (containsGeorgian)
        {
            return Language.Georgian;
        }
        
        return Language.English;
    }
}