using System.Net.Http;
using System.Net.Http.Json;
using Application.MiniApp.Commands;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

/// <summary>
/// Calls Telegram Bot API's refundStarPayment endpoint directly via HTTP because
/// Telegram.Bot 19.x does not yet ship this method.
/// </summary>
public class TelegramRefundClient(
    IHttpClientFactory httpClientFactory,
    BotConfiguration config,
    ILoggerFactory loggerFactory) : ITelegramRefundClient
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<TelegramRefundClient>();

    public async Task<bool> RefundStarPaymentAsync(long userId, string chargeId, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient();
        var url = $"https://api.telegram.org/bot{config.Token}/refundStarPayment";
        try
        {
            var response = await http.PostAsJsonAsync(url, new
            {
                user_id = userId,
                telegram_payment_charge_id = chargeId
            }, ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Telegram refundStarPayment failed: {Status} {Body}",
                    response.StatusCode, body);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram refundStarPayment exception");
            return false;
        }
    }
}
