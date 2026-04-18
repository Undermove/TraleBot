using System.Collections.Frozen;
using System.Collections.Generic;

namespace Trale.MiniApp;

public record ModuleDefinition(string Id, string Directory, int MaxLessons);

/// <summary>
/// Single source of truth for module → question directory mapping.
/// Uses FrozenDictionary (.NET 8+) for optimal read performance on static data.
/// </summary>
public static class ModuleRegistry
{
    private static readonly FrozenDictionary<string, ModuleDefinition> Modules = new Dictionary<string, ModuleDefinition>
    {
        ["alphabet-progressive"] = new("alphabet-progressive", "Lessons/GeorgianAlphabetProgressive", 10),
        ["numbers"] = new("numbers", "Lessons/GeorgianNumbers", 4),
        ["verb-classes"] = new("verb-classes", "Lessons/GeorgianVerbClasses", 5),
        ["version-vowels"] = new("version-vowels", "Lessons/GeorgianVersionVowels", 5),
        ["preverbs"] = new("preverbs", "Lessons/GeorgianPreverbs", 5),
        ["imperfect"] = new("imperfect", "Lessons/GeorgianImperfect", 5),
        ["aorist"] = new("aorist", "Lessons/GeorgianAorist", 5),
        ["pronoun-declension"] = new("pronoun-declension", "Lessons/GeorgianPronounDeclension", 5),
        ["conditionals"] = new("conditionals", "Lessons/GeorgianConditionals", 5),
        ["postpositions"] = new("postpositions", "Lessons/GeorgianPostpositions", 5),
        ["adjectives"] = new("adjectives", "Lessons/GeorgianAdjectives", 5),
        ["cases"] = new("cases", "Lessons/GeorgianCases", 8),
        ["pronouns"] = new("pronouns", "Lessons/GeorgianPronouns", 5),
        ["present-tense"] = new("present-tense", "Lessons/GeorgianPresentTense", 5),
        ["cafe"] = new("cafe", "Lessons/GeorgianVocabCafe", 5),
        ["taxi"] = new("taxi", "Lessons/GeorgianVocabTaxi", 5),
        ["doctor"] = new("doctor", "Lessons/GeorgianVocabDoctor", 5),
        ["shopping"] = new("shopping", "Lessons/GeorgianVocabShopping", 5),
        ["intro"] = new("intro", "Lessons/GeorgianVocabIntro", 6),
        ["emergency"] = new("emergency", "Lessons/GeorgianVocabEmergency", 5),
    }.ToFrozenDictionary();

    public static ModuleDefinition? Get(string moduleId)
    {
        return Modules.GetValueOrDefault(moduleId);
    }

    public static IReadOnlyCollection<string> AllModuleIds => Modules.Keys;
}
