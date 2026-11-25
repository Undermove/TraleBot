using System.Collections.Generic;
using System.Linq;

namespace Application.DailyTask;

/// <summary>
/// Who gets «Задание дня». <see cref="Everyone"/> opens the card and the endpoints to all; the daily reminder
/// goes only to <see cref="TelegramIds"/> (the owner) so opening the task does not start a mass push.
/// </summary>
public class DailyTaskAudience(bool everyone, IEnumerable<long> telegramIds)
{
    private readonly HashSet<long> _telegramIds = telegramIds.ToHashSet();

    public bool Everyone => everyone;

    public IReadOnlyCollection<long> TelegramIds => _telegramIds;

    public bool Includes(long telegramId) => everyone || _telegramIds.Contains(telegramId);
}
