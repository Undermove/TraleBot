using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Infrastructure.Telegram;
using Infrastructure.Telegram.Inline;
using Microsoft.AspNetCore.Mvc;
using Trale.Services;

namespace Trale.Controllers;

/// <summary>
/// The mini-app screen opened from the button above the inline options while a translation is still
/// being looked up (<see cref="InlineTranslation"/>): it asks here until the options are there. Anybody
/// Telegram vouches for may ask — inline mode works for people who never started the bot too.
/// </summary>
[ApiController]
[Route("api/miniapp/inline")]
public class InlineTranslationController(BotConfiguration botConfig, InlineTranslation inline) : Controller
{
    private const string InitDataHeader = "X-Telegram-Init-Data";

    /// <summary>A request waits this long for the options before it answers «pending»; the screen asks again.</summary>
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(3);

    public record TranslateRequest(string? Text);

    [HttpPost("translate")]
    public async Task<IActionResult> Translate([FromBody] TranslateRequest request, CancellationToken ct)
    {
        var initData = Request.Headers.TryGetValue(InitDataHeader, out var values) ? values.ToString() : null;
        if (TelegramInitDataValidator.ValidateAndGetUserId(initData, botConfig.Token) is not { } telegramId)
        {
            return Unauthorized(new { error = "not_authenticated" });
        }

        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return BadRequest(new { error = "invalid_text" });
        }

        var (options, pending) = await inline.OptionsAsync(request.Text, telegramId, Wait, ct);
        return Ok(new
        {
            status = pending ? "pending" : "done",
            options = options.Select(o => new { id = o.Id, title = o.Title, text = o.Text })
        });
    }
}
