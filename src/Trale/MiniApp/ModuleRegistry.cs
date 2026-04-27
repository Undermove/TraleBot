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
        // L11 (audio-choice) temporarily disabled — Piper TTS quality on isolated letters
// is too poor to disambiguate ejective vs aspirated pairs (კ/ქ, ტ/თ, წ/ც, ჭ/ჩ).
// Re-enable once letter audio is re-recorded or replaced with better TTS.
["alphabet-progressive"] = new("alphabet-progressive", "Lessons/GeorgianAlphabetProgressive", 10),
        ["numbers"] = new("numbers", "Lessons/GeorgianNumbers", 5),
        ["verb-classes"] = new("verb-classes", "Lessons/GeorgianVerbClasses", 7),
        ["version-vowels"] = new("version-vowels", "Lessons/GeorgianVersionVowels", 5),
        ["preverbs"] = new("preverbs", "Lessons/GeorgianPreverbs", 5),
        ["imperfect"] = new("imperfect", "Lessons/GeorgianImperfect", 6),
        ["aorist"] = new("aorist", "Lessons/GeorgianAorist", 6),
        ["future-tense"] = new("future-tense", "Lessons/GeorgianFutureTense", 2),
        ["pronoun-declension"] = new("pronoun-declension", "Lessons/GeorgianPronounDeclension", 5),
        ["conditionals"] = new("conditionals", "Lessons/GeorgianConditionals", 5),
        ["imperative"] = new("imperative", "Lessons/GeorgianImperative", 3),
        ["postpositions"] = new("postpositions", "Lessons/GeorgianPostpositions", 6),
        ["adjectives"] = new("adjectives", "Lessons/GeorgianAdjectives", 5),
        ["cases"] = new("cases", "Lessons/GeorgianCases", 8),
        ["pronouns"] = new("pronouns", "Lessons/GeorgianPronouns", 6),
        ["present-tense"] = new("present-tense", "Lessons/GeorgianPresentTense", 6),
        ["cafe"] = new("cafe", "Lessons/GeorgianVocabCafe", 6),
        ["taxi"] = new("taxi", "Lessons/GeorgianVocabTaxi", 5),
        ["doctor"] = new("doctor", "Lessons/GeorgianVocabDoctor", 5),
        ["shopping"] = new("shopping", "Lessons/GeorgianVocabShopping", 5),
        ["intro"] = new("intro", "Lessons/GeorgianVocabIntro", 6),
        ["emergency"] = new("emergency", "Lessons/GeorgianVocabEmergency", 5),
        ["verbs-of-movement"] = new("verbs-of-movement", "Lessons/GeorgianVerbsOfMovement", 12),
    }.ToFrozenDictionary();

    public static ModuleDefinition? Get(string moduleId)
    {
        return Modules.GetValueOrDefault(moduleId);
    }

    public static IReadOnlyCollection<string> AllModuleIds => Modules.Keys;
}
