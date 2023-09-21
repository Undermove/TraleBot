using System.Text.RegularExpressions;

namespace Domain.Quiz;

public static class ReplaceQuizWordExtensions
{
	
	public static string ReplaceWholeWord(this string? input, string wordToReplace, string replacement)
	{
		string pattern = $@"\b{Regex.Escape(wordToReplace)}\b";
		return input == null ? string.Empty : Regex.Replace(input, pattern, replacement);
	}
}