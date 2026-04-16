using Domain.Entities;

namespace Application.MiniApp;

public record SubscriptionPlanInfo(
    SubscriptionPlan Plan,
    string PayloadId,
    int StarsPrice,
    int? DurationDays,
    string Title,
    string Description);

public static class SubscriptionPlans
{
    /// <summary>
    /// Plans available for purchase by end users — exposed via /api/miniapp/plans.
    /// Lifetime is intentionally excluded: legal/operational complexity if the
    /// service shuts down. The enum value still exists so historical grants /
    /// admin-granted Lifetimes stay readable.
    /// </summary>
    public static readonly IReadOnlyList<SubscriptionPlanInfo> All = new List<SubscriptionPlanInfo>
    {
        new(SubscriptionPlan.Month,    "Stars_Pro_Month",    100, 30,  "1 месяц",   "Про-доступ на 30 дней"),
        new(SubscriptionPlan.Quarter,  "Stars_Pro_Quarter",  249, 90,  "3 месяца",  "Про-доступ на 3 месяца"),
        new(SubscriptionPlan.HalfYear, "Stars_Pro_HalfYear", 449, 180, "6 месяцев", "Про-доступ на 6 месяцев"),
        new(SubscriptionPlan.Year,     "Stars_Pro_Year",     849, 365, "1 год",     "Про-доступ на год"),
    };

    /// <summary>
    /// All known plans including Lifetime — for back-compat reading historical
    /// payments / admin grants. NOT in /api/miniapp/plans.
    /// </summary>
    private static readonly IReadOnlyList<SubscriptionPlanInfo> Known = new List<SubscriptionPlanInfo>
    {
        new(SubscriptionPlan.Month,    "Stars_Pro_Month",    100,  30,   "1 месяц",   "Про-доступ на 30 дней"),
        new(SubscriptionPlan.Quarter,  "Stars_Pro_Quarter",  249,  90,   "3 месяца",  "Про-доступ на 3 месяца"),
        new(SubscriptionPlan.HalfYear, "Stars_Pro_HalfYear", 449,  180,  "6 месяцев", "Про-доступ на 6 месяцев"),
        new(SubscriptionPlan.Year,     "Stars_Pro_Year",     849,  365,  "1 год",     "Про-доступ на год"),
        new(SubscriptionPlan.Lifetime, "Stars_Pro_Lifetime", 1399, null, "Навсегда",  "Про-доступ навсегда"),
    };

    public static SubscriptionPlanInfo? ByPayload(string payload) =>
        Known.FirstOrDefault(p => p.PayloadId == payload);

    public static SubscriptionPlanInfo? ByPlan(SubscriptionPlan plan) =>
        Known.FirstOrDefault(p => p.Plan == plan);

    public static bool IsStarsPayload(string? payload) =>
        payload != null && payload.StartsWith("Stars_Pro");
}
