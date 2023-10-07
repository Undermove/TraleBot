using System.Text.RegularExpressions;

namespace Application.Common.Extensions;

public static class LanguageDetectionExtensions
{
    public static string DetectLanguage(this string input)
    {
        string russianPattern = @"[\p{IsCyrillic}]";
        
        bool containsRussian = Regex.IsMatch(input, russianPattern);

        return containsRussian switch
        {
            true when containsRussian => "Russian",
            false when !containsRussian => "English",
            _ => "Mixed languages or unsupported characters"
        };
    }
}