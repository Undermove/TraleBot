using System;
using System.Collections.Generic;

namespace Application.DailyTask;

// What the mini-app gets (mirrored in miniapp-src/src/daily/types.ts). All learner-facing text is
// composed here, so the bot message and the screen say the same thing.

/// <summary>A verb form or a dictionary word. Key: "v:lemma:tense:person" or "w:entryId".</summary>
public record DailyItem(
    string Key, string Kind, string Ka, string Ru,
    string? Lemma = null, string? VerbRu = null, string? Tense = null, int? Person = null);

public record DailyOption(string Ru, bool Ok);

/// <param name="Due">The form came by the repetition schedule (its answer moves the schedule); otherwise it is a long-unseen verb.</param>
public record DailyWarmRound(DailyItem Item, IReadOnlyList<DailyOption> Options, bool Due);

public record DailyPick(DailyItem Item, bool Ok, string Message);

/// <summary>The other way round: the meaning in Russian, the learner picks the Georgian form.</summary>
public record DailyBackRound(DailyItem Item, IReadOnlyList<DailyBackOption> Options);

public record DailyBackOption(DailyItem Item, bool Ok);

public record DailyCheck(string Prompt, string Intro, IReadOnlyList<DailyPick> Picks);

/// <summary>The "new" at the end: fresh forms of a verb, a course lesson or a one-minute module check.</summary>
public record DailyNew(
    string Kind, string Title, string Line, string Say, string Button,
    string? VerbId = null, string? ModuleId = null, int? LessonId = null, IReadOnlyList<int>? CheckLessons = null)
{
    public const string Forms = "forms";
    public const string Lesson = "lesson";
    public const string Check = "check";
}

public record DailyResult(int Errors, int XpEarned, int Streak);

public record DailyTaskDto
{
    /// <summary>False when there is nothing to build a task from — the card is not shown.</summary>
    public bool Available { get; init; }
    public string Day { get; init; } = "";
    public bool Done { get; init; }
    public string Mode { get; init; } = DailyMode.Mix;
    public int Level { get; init; } = 1;
    public string Title { get; init; } = "";
    public IReadOnlyList<string> Chat { get; init; } = [];
    public string Button { get; init; } = "";
    public IReadOnlyList<string> Why { get; init; } = [];
    public int Seconds { get; init; }
    public IReadOnlyList<DailyWarmRound> Warm { get; init; } = [];
    public IReadOnlyList<DailyItem> Pairs { get; init; } = [];
    /// <summary>After the pairs: from Russian into Georgian; empty — no such step (tasks composed before it existed).</summary>
    public IReadOnlyList<DailyBackRound> Back { get; init; } = [];
    public DailyCheck Check { get; init; } = new("", "", []);
    /// <summary>What will be offered at the end if the game goes clean.</summary>
    public DailyNew? Next { get; init; }
    /// <summary>What is actually offered after the result; null — nothing new today.</summary>
    public DailyNew? Offer { get; init; }
    public bool OfferTaken { get; init; }
    public DailyResult? Result { get; init; }
    /// <summary>The extra round being played after the task (a task of its own without warm-up and "new").</summary>
    public DailyTaskDto? Extra { get; init; }
    /// <summary>Extra rounds already played today.</summary>
    public int Extras { get; init; }
    /// <summary>The push of the day: a short headline, one line under it and the button.</summary>
    public DailyPush? Push { get; init; }
    /// <summary>Local stand only: the mini-app shows the "next day" controls.</summary>
    public bool Dev { get; init; }
}

public static class DailyMode
{
    public const string Comeback = "comeback";
    public const string Review = "review";
    public const string Mix = "mix";
}

/// <summary>What the mini-app reports when the task is played to the end.</summary>
public record DailyReport(
    string Day, IReadOnlyCollection<string> WarmWrong, IReadOnlyCollection<string> PairWrong, int Errors, int CheckErrors,
    IReadOnlyCollection<string>? BackWrong = null);

/// <summary>
/// The reminder in the bot: a bold headline that reads well in the chat list, one line under it and the button.
/// Variant names the template, for the analysis of which ones bring people in.
/// </summary>
public record DailyPush(string Variant, string Headline, string Line, string Button);

// What the planner is given.

/// <summary>A form the learner has already opened, with its place on the ladder.</summary>
public record DailyForm(
    string Lemma, string VerbRu, string Tense, int Person, string Ka, string Ru,
    int Step, int BestStep, int Reviews, DateTime? DueAtUtc, DateTime UpdatedAtUtc)
{
    public string Key => $"v:{Lemma}:{Tense}:{Person}";
}

/// <summary>
/// A started verb whose session would open new forms now, and the forms it would open first
/// (the session's own order, up to three) with their meaning.
/// </summary>
public record DailyUnopened(string Lemma, string VerbRu, IReadOnlyList<DailyFresh> Next);

public record DailyFresh(string Tense, int Person, string Ru);

public record DailyWord(Guid Id, string Ka, string Ru, int Ok, int Bad, DateTime AddedAtUtc, DateTime UpdatedAtUtc)
{
    public string Key => $"w:{Id}";
}

public record DailyInput
{
    public required DateTime Now { get; init; }
    /// <summary>Full days without practice before today (0 — practised yesterday or today).</summary>
    public int Away { get; init; }
    /// <summary>The streak as it stands; <see cref="PlayedToday"/> tells whether today is already in it.</summary>
    public int Streak { get; init; }
    public bool PlayedToday { get; init; }
    public bool PlayedYesterday { get; init; }
    public int? Accuracy { get; init; }
    public int LastErrors { get; init; }
    /// <summary>The last task was finished yesterday (its mistakes are "yesterday's").</summary>
    public bool LastTaskYesterday { get; init; }
    public string? LastNew { get; init; }
    public IReadOnlyCollection<string> Missed { get; init; } = [];
    public IReadOnlyList<DailyForm> Forms { get; init; } = [];
    public IReadOnlyList<DailyUnopened> Unopened { get; init; } = [];
    public IReadOnlyList<DailyWord> Words { get; init; } = [];
    /// <summary>The next step of the course, already chosen by <see cref="CoursePlanner"/>.</summary>
    public DailyNew? Course { get; init; }
    /// <summary>Makes shuffles repeatable within a day.</summary>
    public int Seed { get; init; }
}
