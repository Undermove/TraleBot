using System.Collections.Generic;
using System.Linq;

namespace Application.DailyTask;

/// <summary>
/// Who gets «Задание дня». <see cref="Everyone"/> opens the card and the endpoints to all.
/// The daily reminder goes to <see cref="TelegramIds"/> (the owner) and, with <see cref="PushEveryone"/> (prod),
/// to everyone who studied lately; the stand keeps it to the listed people — its database holds real Telegram ids.
/// </summary>
public class DailyTaskAudience(bool everyone, IEnumerable<long> telegramIds, bool pushEveryone = false)
{
    private readonly HashSet<long> _telegramIds = telegramIds.ToHashSet();

    public bool Everyone => everyone;

    public bool PushEveryone => pushEveryone;

    public IReadOnlyCollection<long> TelegramIds => _telegramIds;

    public bool Includes(long telegramId) => everyone || _telegramIds.Contains(telegramId);
}
