using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces;
using Application.Common.Interfaces.MiniApp;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.MiniApp.Commands;

public class CompleteLessonProgress : IRequest<CompleteLessonProgressResult>
{
    public required Guid UserId { get; init; }
    public required string ModuleId { get; init; }
    public required int LessonId { get; init; }
    public required int Correct { get; init; }
    public required int Total { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        IProgressCalculator progressCalculator,
        IUserNotificationService notificationService,
        ILoggerFactory loggerFactory)
        : IRequestHandler<CompleteLessonProgress, CompleteLessonProgressResult>
    {
        public async Task<CompleteLessonProgressResult> Handle(CompleteLessonProgress request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.ModuleId) || request.Total <= 0)
            {
                return new CompleteLessonProgressResult.InvalidRequest();
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            var update = progressCalculator.CalculateLessonCompletion(
                progress, request.ModuleId, request.LessonId, request.Correct, request.Total);
            await dbContext.SaveChangesAsync(ct);

            if (update.LessonCompleted && PinChatTip.IsFirstLesson(progress.CompletedLessonsJson))
                await SendPinChatTipAsync(request.UserId, ct);

            return new CompleteLessonProgressResult.Success(
                update.XpEarned,
                progressCalculator.SerializeProgress(progress));
        }

        /// <summary>Once per person; a failure to send never fails the lesson.</summary>
        private async Task SendPinChatTipAsync(Guid userId, CancellationToken ct)
        {
            try
            {
                var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
                if (user is not { IsActive: true, NotificationsEnabled: true }) return;
                if (!await dbContext.TryClaimNotificationTriggerAsync(user.TelegramId, PinChatTip.Source, null, DateTime.UtcNow, DateTime.UnixEpoch, ct))
                    return;

                await notificationService.SendPinChatTipAsync(user, ct);
                await dbContext.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                loggerFactory.CreateLogger<CompleteLessonProgress>().LogWarning(ex, "Pin-chat tip for user {UserId} was not sent", userId);
            }
        }
    }
}

public abstract record CompleteLessonProgressResult
{
    public record Success(int XpEarned, object Progress) : CompleteLessonProgressResult;
    public record InvalidRequest : CompleteLessonProgressResult;
}
