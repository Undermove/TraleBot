using System.Collections.Generic;
using System.Linq;

namespace Application.DailyTask;

/// <summary>
/// Who gets «Задание дня» — the card, the endpoints and the daily reminder. While it is being tried out:
/// in production only the listed people (the owner), on the local stand everyone.
/// </summary>
public class DailyTaskAudience(bool everyone, IEnumerable<long> telegramIds)
{
    private readonly HashSet<long> _telegramIds = telegramIds.ToHashSet();

    public bool Everyone => everyone;

    public IReadOnlyCollection<long> TelegramIds => _telegramIds;

    public bool Includes(long telegramId) => everyone || _telegramIds.Contains(telegramId);
}
