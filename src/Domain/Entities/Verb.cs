// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// A Georgian verb with its full paradigm, served to the mini-app "Глаголы" section.
/// Curated verbs are loaded from <c>src/Trale/Verbs/verbs.json</c>; the summary columns back the
/// list screen, <see cref="CardJson"/> holds the ready-to-serve card payload.
/// </summary>
public class Verb
{
    public Guid Id { get; set; }

    /// <summary>Dictionary form (3rd person singular present), e.g. წერს. Unique; used as the public id.</summary>
    public required string Lemma { get; set; }

    /// <summary>Masdar shown as the card title, e.g. წერა.</summary>
    public required string Title { get; set; }

    /// <summary>Russian translation.</summary>
    public required string Translation { get; set; }

    /// <summary>"pattern" | "feature" | "special" — how regular the conjugation is.</summary>
    public required string Kind { get; set; }

    /// <summary>JSON array with the 1st person singular present form(s), shown in the list row.</summary>
    public required string PresentJson { get; set; }

    /// <summary>JSON of the full card: paradigm, root, odd tenses, model verb, source.</summary>
    public required string CardJson { get; set; }

    public VerbStatus Status { get; set; }

    /// <summary>Position in the list: catalog order, regular verbs first.</summary>
    public int SortOrder { get; set; }

    /// <summary>Hash of the catalog entry this row was built from — lets the seeder skip unchanged verbs.</summary>
    public required string ContentHash { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public virtual ICollection<VerbForm> Forms { get; set; } = new List<VerbForm>();
}

public enum VerbStatus
{
    /// <summary>Every form traced to an open source and reviewed in a PR.</summary>
    Verified = 0,

    /// <summary>
    /// Written by a model at a user's request and approved by a second model — see
    /// <see cref="VerbProvenance"/>. Served and learned like a verified verb; a human revision may follow.
    /// </summary>
    Generated = 1
}
