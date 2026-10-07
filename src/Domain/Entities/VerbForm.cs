// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// One inflected form of a <see cref="Verb"/> — the lookup index behind "paste any form, get the parse".
/// </summary>
public class VerbForm
{
    public Guid Id { get; set; }

    public Guid VerbId { get; set; }
    public virtual Verb Verb { get; set; } = null!;

    public required string Form { get; set; }

    /// <summary>Tense key as used by the mini-app: present, aorist, optative, …</summary>
    public required string Tense { get; set; }

    /// <summary>0..5 — я, ты, он, мы, вы, они.</summary>
    public int Person { get; set; }

    /// <summary>
    /// What the form means in plain Russian, conjugated for this verb: «я хочу», «ты хотел(а)».
    /// Shown instead of a tense name wherever a learner meets the form. Null for rare tenses and for
    /// verbs generated at runtime — the UI then falls back to person + a time word.
    /// </summary>
    public string? Meaning { get; set; }

    /// <summary>
    /// Short note that tells apart tenses whose Russian phrase is the same («я писал(а)» — "once, done"
    /// vs "long or often"). Null when the phrase alone is unambiguous.
    /// </summary>
    public string? MeaningNote { get; set; }

    /// <summary>
    /// The form belongs to a tense of a model-made verb that nothing but the model vouches for (real
    /// texts do not have its forms, the owner has not confirmed it). Such a form is shown in the verb's
    /// card with a mark and is used nowhere else: not in games, not in the parse of a word. Always
    /// false for curated verbs and verbs taken from a source table.
    /// </summary>
    public bool Unverified { get; set; }
}
