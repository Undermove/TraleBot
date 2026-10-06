// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// One learner's relationship with one verb: how well they know it and what the session director
/// remembers between sessions. A row appears when the learner first plays the verb — from the
/// dictionary, a lesson or a translation — so "my verbs" is dictionary verbs plus these rows.
/// Per-form detail lives in <see cref="VerbFormProgress"/>; <see cref="Level"/> is derived from it
/// (and from the exam) every time a session is saved.
/// </summary>
public class UserVerb
{
    /// <summary>How many recent sessions the director remembers to avoid repeating itself.</summary>
    public const int RecentSessionsKept = 6;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;

    public Guid VerbId { get; set; }
    public virtual Verb Verb { get; set; } = null!;

    /// <summary>Never goes down: a forgotten form comes back into play, the level stays.</summary>
    public VerbLevel Level { get; set; }

    public DateTime StartedAtUtc { get; set; }

    /// <summary>Finished sessions.</summary>
    public int SessionsPlayed { get; set; }

    public DateTime? LastPlayedAtUtc { get; set; }

    /// <summary>When the final exam was passed — that is what makes the verb "learned".</summary>
    public DateTime? ExamPassedAtUtc { get; set; }

    /// <summary>JSON array of recent sessions, oldest first; each entry is its scene types joined by '+' ("meet+time").</summary>
    public string RecentScenesJson { get; set; } = "[]";

    /// <summary>The verb's comic was read to the end.</summary>
    public bool StoryCompleted { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>A small human scale of how well a verb is known. Stored as a number; order matters.</summary>
public enum VerbLevel
{
    /// <summary>Nothing played yet.</summary>
    New = 0,

    /// <summary>The first forms were shown.</summary>
    Meeting = 1,

    /// <summary>A few forms are recognised and picked out of options.</summary>
    Recognising = 2,

    /// <summary>A third of the forms are solid — time to produce phrases.</summary>
    Phrases = 3,

    /// <summary>Most main forms are solid — the exam is offered.</summary>
    ExamReady = 4,

    /// <summary>The exam is passed.</summary>
    Learned = 5
}
