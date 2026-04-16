using System.Threading;
using System.Threading.Tasks;
using Application.Admin;
using Application.Common;
using Infrastructure.Telegram;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trale.Services;

namespace Trale.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : Controller
{
    private const string InitDataHeader = "X-Telegram-Init-Data";

    // Hardcoded owner Telegram ID for now (matches GetMiniAppProfile.cs).
    // BotConfiguration.OwnerTelegramId can override via env BOTCONFIGURATION__OWNERTELEGRAMID.
    private const long DefaultOwnerTelegramId = 309149393;

    private readonly ITraleDbContext _dbContext;
    private readonly BotConfiguration _botConfig;
    private readonly GetAdminStatsQuery _statsQuery;
    private readonly GetUserSignupsTimeseriesQuery _timeseriesQuery;
    private readonly GetRecentUsersQuery _recentUsersQuery;

    public AdminController(
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        GetAdminStatsQuery statsQuery,
        GetUserSignupsTimeseriesQuery timeseriesQuery,
        GetRecentUsersQuery recentUsersQuery)
    {
        _dbContext = dbContext;
        _botConfig = botConfig;
        _statsQuery = statsQuery;
        _timeseriesQuery = timeseriesQuery;
        _recentUsersQuery = recentUsersQuery;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound(); // hide existence from non-owners
        }

        var stats = await _statsQuery.ExecuteAsync(ct);
        return Ok(stats);
    }

    [HttpGet("signups")]
    public async Task<IActionResult> Signups([FromQuery] int days = 30, CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound();
        }

        var points = await _timeseriesQuery.ExecuteAsync(days, ct);
        return Ok(new { days, points });
    }

    [HttpGet("recent-users")]
    public async Task<IActionResult> RecentUsers([FromQuery] int limit = 20, CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound();
        }

        var users = await _recentUsersQuery.ExecuteAsync(limit, ct);
        return Ok(new { users });
    }

    /// <summary>
    /// Returns true ONLY if the request is authenticated via X-Telegram-Init-Data
    /// AND the verified Telegram ID matches the configured owner. Otherwise everything
    /// returns 404 to avoid revealing the admin endpoints.
    /// </summary>
    private async Task<bool> IsOwnerAsync(CancellationToken ct)
    {
        var initData = Request.Headers.TryGetValue(InitDataHeader, out var values)
            ? values.ToString()
            : null;

        var telegramId = TelegramInitDataValidator.ValidateAndGetUserId(initData, _botConfig.Token);
        if (telegramId == null)
        {
            return false;
        }

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        if (telegramId.Value != ownerId)
        {
            return false;
        }

        // Belt-and-suspenders: confirm the user exists in DB
        var exists = await _dbContext.Users.AnyAsync(u => u.TelegramId == telegramId.Value, ct);
        return exists;
    }
}
