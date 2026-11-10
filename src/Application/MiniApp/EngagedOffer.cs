using Domain.Entities;

namespace Application.MiniApp;

/// <summary>
/// The day-7 message to a newcomer who studies in earnest: the old prices — until the rise for everyone,
/// after it for this person for <see cref="PriceSchedule.OfferLasts"/>. Paid days start after the free ones,
/// so buying early loses nothing.
/// </summary>
public static class EngagedOffer
{
    /// <summary>Lessons finished in the first week, on at least <see cref="MinDays"/> different days.</summary>
    public const int MinLessons = 5;
    public const int MinDays = 2;

    private static readonly string[] Months =
        ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

    /// <summary>«1 декабря» / «12 декабря, 18:00» — Tbilisi time (UTC+4, no daylight saving).</summary>
    public static string TbilisiDate(DateTime utc, bool withTime = false)
    {
        var t = utc.AddHours(4);
        return withTime ? $"{t.Day} {Months[t.Month - 1]}, {t:HH:mm}" : $"{t.Day} {Months[t.Month - 1]}";
    }

    public static string Button(DateTime nowUtc, PriceSchedule prices) =>
        prices.HasRisen(nowUtc) ? "Купить по сниженной цене" : "Купить по старой цене";

    public static string Text(int lessons, DateTime nowUtc, PriceSchedule prices)
    {
        var quarter = SubscriptionPlans.ByPlan(SubscriptionPlan.Quarter)!;
        var year = SubscriptionPlans.ByPlan(SubscriptionPlan.Year)!;
        var head = $"Уроков за неделю: {lessons} — ты занимаешься всерьёз 💪";
        const string freeDays = "Бесплатные дни не сгорят: оплаченный срок начнётся после них.";

        if (!prices.HasRisen(nowUtc))
            return $"""
                {head}

                С {TbilisiDate(prices.RiseAtUtc)} цены вырастут, а пока:
                • 3 месяца — {quarter.StarsPrice} ⭐ (потом {SubscriptionPlans.RaisedPrice(quarter)} ⭐)
                • год — {year.StarsPrice} ⭐ (потом {SubscriptionPlans.RaisedPrice(year)} ⭐)

                Кто купит до {TbilisiDate(prices.RiseAtUtc)}, будет продлевать по этой цене и дальше — навсегда. {freeDays}

                Купи сейчас — кнопка ниже.
                """;

        return $"""
            {head}

            Специально для тебя — сниженная цена на 72 часа, до {TbilisiDate(nowUtc + PriceSchedule.OfferLasts, withTime: true)} по Тбилиси:
            • 3 месяца — {quarter.StarsPrice} ⭐ вместо {SubscriptionPlans.RaisedPrice(quarter)} ⭐
            • год — {year.StarsPrice} ⭐ вместо {SubscriptionPlans.RaisedPrice(year)} ⭐

            {freeDays}

            Купи сейчас по сниженной цене — кнопка ниже.
            """;
    }
}
