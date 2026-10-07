// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

public enum QueuedTranslationSource
{
    /// <summary>A word sent to the bot: the answer is a message in the chat.</summary>
    Bot = 0,

    /// <summary>A word typed in the mini-app: the answer is picked up by <c>translate/status</c>.</summary>
    MiniApp = 1
}

public enum QueuedTranslationState
{
    /// <summary>Being translated — or waiting for an instance to take it.</summary>
    Pending = 0,

    /// <summary>Translated; the answer is being sent to the chat.</summary>
    Answering = 1,

    /// <summary>The person has the answer (<see cref="QueuedTranslation.Outcome"/>). Final.</summary>
    Done = 2,

    /// <summary>Given up after <c>TranslationAgent:JobMaxAttempts</c>; the person was told so. Final.</summary>
    Failed = 3
}

/// <summary>
/// A translation that takes longer than its request (a verb the models have to write): the durable
/// record of it, kept from the moment the request stops waiting until the person has the answer.
/// <para>
/// One instance works on it at a time — the one holding the lease (<see cref="LeaseOwner"/>,
/// <see cref="LeaseUntilUtc"/>, renewed while it works). When that instance dies the lease runs out,
/// and the background job queued for this record takes the work over on any instance. The record is
/// also what keeps the answer single: a run that finds it <see cref="QueuedTranslationState.Done"/>
/// sends nothing, and a run that lost its lease may not answer.
/// </para>
/// </summary>
public class QueuedTranslation
{
    public Guid Id { get; set; }

    public QueuedTranslationSource Source { get; set; }

    public Guid UserId { get; set; }

    /// <summary>The text as the person sent it.</summary>
    public required string Word { get; set; }

    /// <summary>Trimmed and lower-cased <see cref="Word"/>: what the mini-app asks the status by.</summary>
    public required string WordKey { get; set; }

    /// <summary>Bot only: where the answer goes and which message it quotes.</summary>
    public long? ChatId { get; set; }

    /// <inheritdoc cref="ChatId"/>
    public int? MessageId { get; set; }

    public QueuedTranslationState State { get; set; }

    /// <summary>How it ended, in the words of the mini-app's API: <see cref="QueuedTranslationOutcome"/>.</summary>
    public string? Outcome { get; set; }

    /// <summary>The saved word, when the outcome is a translation.</summary>
    public Guid? VocabularyEntryId { get; set; }

    /// <summary>A verb is being looked up (the slow part) — the mini-app then says «ищу глагол…».</summary>
    public bool VerbLookup { get; set; }

    /// <summary>
    /// Which step the work is at, for a progress display. Nothing writes it yet: the column is here
    /// for the pipeline's stage reports.
    /// </summary>
    public string? Stage { get; set; }

    /// <summary>Bot only: «Ищу этот глагол…» has been sent, so a later run does not say it again.</summary>
    public bool NoticeSent { get; set; }

    /// <summary>How many runs have started. The fencing token of a run, together with <see cref="LeaseOwner"/>.</summary>
    public int Attempts { get; set; }

    /// <summary>The application instance working on it now.</summary>
    public Guid? LeaseOwner { get; set; }

    /// <summary>Until when that instance is believed alive; null or past = free to take.</summary>
    public DateTime? LeaseUntilUtc { get; set; }

    /// <summary>When the person asked.</summary>
    public DateTime CreatedAtUtc { get; set; }

    public DateTime? FinishedAtUtc { get; set; }

    public bool IsFinished => State is QueuedTranslationState.Done or QueuedTranslationState.Failed;
}

/// <summary>Values of <see cref="QueuedTranslation.Outcome"/> — the <c>status</c> strings of <c>POST /api/miniapp/translate</c>.</summary>
public static class QueuedTranslationOutcome
{
    public const string Success = "success";
    public const string Exists = "exists";
    public const string Failure = "failure";
    public const string NotAWord = "not_a_word";
    public const string TooLong = "too_long";
    public const string Emoji = "emoji";
}
