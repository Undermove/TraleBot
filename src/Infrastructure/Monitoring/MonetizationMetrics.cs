using System.Diagnostics.Metrics;

namespace Infrastructure.Monitoring;

/// <summary>
/// Prometheus metrics for monetization funnel — exposed at /metrics endpoint.
/// Used to track: paywall views, invoice creations, successful purchases, refunds.
/// </summary>
public class MonetizationMetrics : IDisposable
{
    public const string MeterName = "TraleBot.Monetization";

    private readonly Meter _meter;

    public Counter<long> InvoiceCreated { get; }
    public Counter<long> PurchaseSucceeded { get; }
    public Counter<long> PurchaseFailed { get; }
    public Counter<long> RefundSucceeded { get; }
    public Counter<long> RefundFailed { get; }

    public MonetizationMetrics()
    {
        _meter = new Meter(MeterName, "1.0");
        InvoiceCreated = _meter.CreateCounter<long>(
            "tralebot_invoice_created_total",
            description: "Total Telegram Stars invoice links created (by plan)");
        PurchaseSucceeded = _meter.CreateCounter<long>(
            "tralebot_purchase_succeeded_total",
            description: "Total successful Stars purchases (by plan)");
        PurchaseFailed = _meter.CreateCounter<long>(
            "tralebot_purchase_failed_total",
            description: "Total failed Stars purchase attempts");
        RefundSucceeded = _meter.CreateCounter<long>(
            "tralebot_refund_succeeded_total",
            description: "Total successful Stars refunds");
        RefundFailed = _meter.CreateCounter<long>(
            "tralebot_refund_failed_total",
            description: "Total failed refund attempts (by reason)");
    }

    public void Dispose()
    {
        _meter.Dispose();
    }
}
