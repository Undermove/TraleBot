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
        ["alphabet-progressive"] = new("alphabet-progressive", "GeorgianAlphabetProgressive", 10),
        ["numbers"] = new("numbers", "GeorgianNumbers", 4),
        ["verb-classes"] = new("verb-classes", "GeorgianVerbClasses", 5),
        ["version-vowels"] = new("version-vowels", "GeorgianVersionVowels", 5),
        ["preverbs"] = new("preverbs", "GeorgianPreverbs", 5),
        ["imperfect"] = new("imperfect", "GeorgianImperfect", 5),
        ["aorist"] = new("aorist", "GeorgianAorist", 5),
        ["pronoun-declension"] = new("pronoun-declension", "GeorgianPronounDeclension", 5),
        ["conditionals"] = new("conditionals", "GeorgianConditionals", 5),
        ["postpositions"] = new("postpositions", "GeorgianPostpositions", 5),
        ["adjectives"] = new("adjectives", "GeorgianAdjectives", 5),
        ["cases"] = new("cases", "GeorgianCases", 8),
        ["pronouns"] = new("pronouns", "GeorgianPronouns", 5),
        ["present-tense"] = new("present-tense", "GeorgianPresentTense", 5),
        ["cafe"] = new("cafe", "GeorgianVocabCafe", 5),
        ["taxi"] = new("taxi", "GeorgianVocabTaxi", 5),
        ["doctor"] = new("doctor", "GeorgianVocabDoctor", 5),
        ["shopping"] = new("shopping", "GeorgianVocabShopping", 5),
        ["intro"] = new("intro", "GeorgianVocabIntro", 5),
        ["emergency"] = new("emergency", "GeorgianVocabEmergency", 5),
    }.ToFrozenDictionary();

    public static ModuleDefinition? Get(string moduleId)
    {
        return Modules.GetValueOrDefault(moduleId);
    }

    public static IReadOnlyCollection<string> AllModuleIds => Modules.Keys;
}
