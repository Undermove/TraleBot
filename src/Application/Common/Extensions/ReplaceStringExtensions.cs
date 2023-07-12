using System.Text.RegularExpressions;

namespace Application.Common.Extensions;

public static class ReplaceStringExtensions
{
	
	public static string ReplaceWholeWord(this string input, string wordToReplace, string replacement)
	{
		string pattern = $@"\b{Regex.Escape(wordToReplace)}\b";
		return Regex.Replace(input, pattern, replacement);
	}
}