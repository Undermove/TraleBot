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
        ["alphabet-progressive"] = new("alphabet-progressive", "Lessons/GeorgianAlphabetProgressive", 11),
        ["numbers"] = new("numbers", "Lessons/GeorgianNumbers", 5),
        ["verb-classes"] = new("verb-classes", "Lessons/GeorgianVerbClasses", 7),
        ["version-vowels"] = new("version-vowels", "Lessons/GeorgianVersionVowels", 6),
        ["preverbs"] = new("preverbs", "Lessons/GeorgianPreverbs", 6),
        ["imperfect"] = new("imperfect", "Lessons/GeorgianImperfect", 6),
        ["aorist"] = new("aorist", "Lessons/GeorgianAorist", 6),
        ["future-tense"] = new("future-tense", "Lessons/GeorgianFutureTense", 5),
        ["pronoun-declension"] = new("pronoun-declension", "Lessons/GeorgianPronounDeclension", 6),
        ["conditionals"] = new("conditionals", "Lessons/GeorgianConditionals", 6),
        ["imperative"] = new("imperative", "Lessons/GeorgianImperative", 3),
        ["postpositions"] = new("postpositions", "Lessons/GeorgianPostpositions", 6),
        ["adjectives"] = new("adjectives", "Lessons/GeorgianAdjectives", 6),
        ["cases"] = new("cases", "Lessons/GeorgianCases", 9),
        ["pronouns"] = new("pronouns", "Lessons/GeorgianPronouns", 6),
        ["present-tense"] = new("present-tense", "Lessons/GeorgianPresentTense", 6),
        ["cafe"] = new("cafe", "Lessons/GeorgianVocabCafe", 6),
        ["taxi"] = new("taxi", "Lessons/GeorgianVocabTaxi", 6),
        ["doctor"] = new("doctor", "Lessons/GeorgianVocabDoctor", 6),
        ["shopping"] = new("shopping", "Lessons/GeorgianVocabShopping", 6),
        ["intro"] = new("intro", "Lessons/GeorgianVocabIntro", 8),
        ["emergency"] = new("emergency", "Lessons/GeorgianVocabEmergency", 6),
        ["verbs-of-movement"] = new("verbs-of-movement", "Lessons/GeorgianVerbsOfMovement", 12),
    }.ToFrozenDictionary();

    public static ModuleDefinition? Get(string moduleId)
    {
        return Modules.GetValueOrDefault(moduleId);
    }

    public static IReadOnlyCollection<string> AllModuleIds => Modules.Keys;
}
