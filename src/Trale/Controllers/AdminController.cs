using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Admin;
using Application.Common;
using Application.Common.Interfaces;
using Application.Notifications;
using Application.Notifications.Holidays;
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
    private readonly GetUserDetailQuery _userDetailQuery;
    private readonly GrantProService _grantPro;
    private readonly RevokeProService _revokePro;
    private readonly BroadcastService _broadcast;
    private readonly IUserNotificationService _notifications;
    private readonly IHolidayCalendarService _holidayCalendar;

    public AdminController(
        ITraleDbContext dbContext,
        BotConfiguration botConfig,
        GetAdminStatsQuery statsQuery,
        GetUserSignupsTimeseriesQuery timeseriesQuery,
        GetRecentUsersQuery recentUsersQuery,
        GetUserDetailQuery userDetailQuery,
        GrantProService grantPro,
        RevokeProService revokePro,
        BroadcastService broadcast,
        IUserNotificationService notifications,
        IHolidayCalendarService holidayCalendar)
    {
        _dbContext = dbContext;
        _botConfig = botConfig;
        _statsQuery = statsQuery;
        _timeseriesQuery = timeseriesQuery;
        _recentUsersQuery = recentUsersQuery;
        _userDetailQuery = userDetailQuery;
        _grantPro = grantPro;
        _revokePro = revokePro;
        _broadcast = broadcast;
        _notifications = notifications;
        _holidayCalendar = holidayCalendar;
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
    public async Task<IActionResult> RecentUsers(
        [FromQuery] int limit = 20,
        [FromQuery] string? search = null,
        [FromQuery] string sort = "recent_signup",
        CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct))
        {
            return NotFound();
        }

        var sortEnum = sort switch
        {
            "recent_activity" => RecentUsersSort.RecentActivity,
            "vocab_count" => RecentUsersSort.VocabularyCount,
            _ => RecentUsersSort.RecentSignup
        };

        var users = await _recentUsersQuery.ExecuteAsync(limit, search, sortEnum, ct);
        return Ok(new { users });
    }

    [HttpGet("users/{telegramId:long}")]
    public async Task<IActionResult> UserDetail(long telegramId, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var detail = await _userDetailQuery.ExecuteAsync(telegramId, ct);
        if (detail == null) return NotFound();
        return Ok(detail);
    }

    public class GrantProRequest
    {
        public string Plan { get; set; } = string.Empty;
    }

    [HttpPost("users/{telegramId:long}/grant-pro")]
    public async Task<IActionResult> GrantPro(long telegramId, [FromBody] GrantProRequest req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var result = await _grantPro.ExecuteAsync(telegramId, req.Plan, ct);
        return result switch
        {
            GrantProResult.Success => Ok(new { ok = true }),
            GrantProResult.UserNotFound => NotFound(new { error = "user_not_found" }),
            GrantProResult.InvalidPlan => BadRequest(new { error = "invalid_plan" }),
            _ => StatusCode(500)
        };
    }

    [HttpPost("users/{telegramId:long}/revoke-pro")]
    public async Task<IActionResult> RevokePro(long telegramId, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var ok = await _revokePro.ExecuteAsync(telegramId, ct);
        return ok ? Ok(new { ok = true }) : NotFound(new { error = "user_not_found" });
    }

    public class TestReturnPushRequest
    {
        public string? ModuleName { get; set; }
        public string? ModuleId { get; set; }
        public int? LessonId { get; set; }
        public string? Variant { get; set; }
    }

    /// <summary>
    /// Fires the real D1+ return push (the same code ReturnPushWorker sends daily)
    /// to the owner's own Telegram, so the copy + deep-link button can be tested
    /// on demand without waiting for the 10:00 UTC schedule. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-return-push")]
    public async Task<IActionResult> TestReturnPush([FromBody] TestReturnPushRequest? req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });

        // Honour the opt-out, exactly like the daily dispatch would: a user who
        // turned notifications off in Profile gets skipped (no push sent).
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        // Real spendable XP (Xp − XpSpent), so the "feed" copy shows your actual balance.
        var progress = await _dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == owner.Id, ct);
        var availableXp = progress != null ? Math.Max(0, progress.Xp - progress.XpSpent) : 0;

        var allowed = new[] { "miss", "module", "feed", "earn" };
        var variant = allowed.Contains(req?.Variant) ? req!.Variant! : "feed";
        var moduleName = string.IsNullOrWhiteSpace(req?.ModuleName) ? "Падежи" : req!.ModuleName!.Trim();
        var moduleId = string.IsNullOrWhiteSpace(req?.ModuleId) ? "cases" : req!.ModuleId!.Trim();
        var lessonId = req?.LessonId is int l && l > 0 ? l : 1;

        await _notifications.SendDailyReturnPushAsync(owner, moduleName, moduleId, lessonId, variant, availableXp, ct);
        return Ok(new { ok = true, sentTo = ownerId, variant, availableXp, moduleName, moduleId, lessonId });
    }

    /// <summary>A representative holiday for the test button on days with no real one.</summary>
    private static readonly Holiday SampleHoliday = new(
        "sample",
        "Тестовый праздник",
        "სატესტო დღესასწაული",
        "გილოცავ დღესასწაულს",
        "гилоцав дгесасцаулс",
        "поздравляю с праздником");

    /// <summary>
    /// Fires the §82 Holiday push to the owner's own Telegram, bypassing the hourly
    /// worker's morning window + 24h cooldown so the copy + button can be checked on
    /// demand. Uses today's Tbilisi holiday if there is one, else a sample. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-holiday-push")]
    public async Task<IActionResult> TestHolidayPush(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var tbilisiDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(TbilisiMorningWindow.TbilisiOffsetHours));
        var holiday = _holidayCalendar.GetHolidayFor(tbilisiDate) ?? SampleHoliday;

        await _notifications.SendHolidayPushAsync(owner, holiday, ct);
        return Ok(new { ok = true, sentTo = ownerId, holiday = holiday.Key, holiday.RussianName });
    }

    /// <summary>
    /// Fires the §82 Coins-stale push to the owner, bypassing the 7-day cooldown +
    /// "no feeding in 7d" gate. Uses the owner's real spendable XP. Owner-only.
    /// </summary>
    [HttpPost("notifications/test-coins-push")]
    public async Task<IActionResult> TestCoinsPush(CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var progress = await _dbContext.MiniAppUserProgresses
            .FirstOrDefaultAsync(p => p.UserId == owner.Id, ct);
        var availableXp = progress != null ? Math.Max(0, progress.Xp - progress.XpSpent) : 0;

        await _notifications.SendCoinsStalePushAsync(owner, availableXp, ct);
        return Ok(new { ok = true, sentTo = ownerId, availableXp });
    }

    public class TestStreakPushRequest
    {
        public int? Milestone { get; set; }
    }

    /// <summary>
    /// Fires the §82 Streak-milestone push to the owner, bypassing the milestone +
    /// 7-day cooldown gate. Milestone defaults to 7 (allowed: 7/30/100). Owner-only.
    /// </summary>
    [HttpPost("notifications/test-streak-push")]
    public async Task<IActionResult> TestStreakPush([FromBody] TestStreakPushRequest? req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();

        var ownerId = _botConfig.OwnerTelegramId != 0 ? _botConfig.OwnerTelegramId : DefaultOwnerTelegramId;
        var owner = await _dbContext.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerId, ct);
        if (owner == null) return NotFound(new { error = "owner_user_not_found" });
        if (!owner.NotificationsEnabled)
            return Ok(new { ok = false, reason = "notifications_disabled" });

        var allowed = new[] { 7, 30, 100 };
        var milestone = req?.Milestone is int m && allowed.Contains(m) ? m : 7;

        await _notifications.SendStreakMilestonePushAsync(owner, milestone, ct);
        return Ok(new { ok = true, sentTo = ownerId, milestone });
    }

    [HttpGet("broadcast/preview")]
    public async Task<IActionResult> BroadcastPreview(
        [FromQuery] int? activeWithinDays,
        [FromQuery] int minVocab = 0,
        [FromQuery] DateTime? registeredAfterUtc = null,
        [FromQuery] DateTime? registeredBeforeUtc = null,
        [FromQuery] string? proStatus = null,
        CancellationToken ct = default)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var segment = new BroadcastSegment
        {
            ActiveWithinDays = activeWithinDays,
            MinVocabularyCount = minVocab,
            RegisteredAfterUtc = registeredAfterUtc,
            RegisteredBeforeUtc = registeredBeforeUtc,
            ProStatus = ParseProStatus(proStatus)
        };
        var preview = await _broadcast.PreviewAsync(segment, ct);
        return Ok(preview);
    }

    public class BroadcastRequest
    {
        public int? ActiveWithinDays { get; set; }
        public int MinVocabularyCount { get; set; }
        public DateTime? RegisteredAfterUtc { get; set; }
        public DateTime? RegisteredBeforeUtc { get; set; }
        public string? ProStatus { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? GrantPlan { get; set; }
        public bool DryRun { get; set; } = true;
        public bool IncludeMiniAppButton { get; set; } = true;
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest req, CancellationToken ct)
    {
        if (!await IsOwnerAsync(ct)) return NotFound();
        var segment = new BroadcastSegment
        {
            ActiveWithinDays = req.ActiveWithinDays,
            MinVocabularyCount = req.MinVocabularyCount,
            RegisteredAfterUtc = req.RegisteredAfterUtc,
            RegisteredBeforeUtc = req.RegisteredBeforeUtc,
            ProStatus = ParseProStatus(req.ProStatus)
        };
        var result = await _broadcast.ExecuteAsync(
            segment, req.Message, req.GrantPlan, req.DryRun, req.IncludeMiniAppButton, ct);
        if (result.Error != null) return BadRequest(result);
        return Ok(result);
    }

    private static BroadcastProFilter ParseProStatus(string? v) => v switch
    {
        "active" => BroadcastProFilter.ActiveProOnly,
        "free" => BroadcastProFilter.NoActiveProOnly,
        _ => BroadcastProFilter.Any
    };

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
