// ReSharper disable PropertyCanBeMadeInitOnly.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace Domain.Entities;

/// <summary>
/// How many translation requests reached a model on one UTC day — for everyone together
/// (<see cref="UserId"/> = <see cref="Everyone"/>) and for each user. The counters behind the daily
/// caps of the translation agent: they live in the database, so a restart does not start the day anew.
/// </summary>
public class ModelBudgetDay
{
    /// <summary>The row that counts all users together.</summary>
    public static readonly Guid Everyone = Guid.Empty;

    public Guid Id { get; set; }

    public DateOnly Day { get; set; }

    /// <summary>The user, or <see cref="Everyone"/>. Not a foreign key: the overall row has no user.</summary>
    public Guid UserId { get; set; }

    /// <summary>Requests that went to any model.</summary>
    public int Requests { get; set; }

    /// <summary>Requests that went on to the strong model (a verb being written).</summary>
    public int Generations { get; set; }
}
