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
}
