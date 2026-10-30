using System.Text.RegularExpressions;
using Domain.Entities;

namespace Application.Verbs;

/// <summary>
/// The Georgian side of a translated verb is the name of the action, and one name can stand for two
/// verbs: კითხვა is both «читать» (ვკითხულობ) and «спрашивать» (ვეკითხები). A quiz that shows the
/// name puts this «я» form next to it in brackets — «კითხვა (ვკითხულობ)» — so it is clear which verb
/// is asked, without giving the Russian answer away.
/// </summary>
public static class VerbEntryHint
{
    // GeorgianTranslationPipeline.AnswerFromVerb writes «название действия; «я читаю» — ვკითხულობ; …»
    private static readonly Regex FirstPersonForm = new("«я [^»]+» — ([ა-ჰ]+)");

    /// <summary>The «я» form of the verb the entry names; null for an entry that is not a name of an action.</summary>
    public static string? Of(VocabularyEntry entry)
    {
        if (!entry.AdditionalInfo.Contains(VerbCardWording.ActionName))
        {
            return null;
        }

        var form = FirstPersonForm.Match(entry.AdditionalInfo);
        return form.Success && form.Groups[1].Value != entry.Definition ? form.Groups[1].Value : null;
    }
}
