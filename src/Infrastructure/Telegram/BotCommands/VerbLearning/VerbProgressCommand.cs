using Application.GeorgianVerbs;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.VerbLearning;

public class VerbProgressCommand(IMediator mediator, ITelegramBotClient client)
    : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var text = request.Text;
        return Task.FromResult(
            text.Equals(CommandNames.VerbProgress, StringComparison.InvariantCultureIgnoreCase) ||
            text.StartsWith(CommandNames.VerbProgressIcon, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        if (request.User == null)
            return;

        var dailyQuery = new GetVerbProgressQuery 
        { 
            UserId = request.User.Id,
            Range = ProgressRange.Daily
        };
        var dailyResult = await mediator.Send(dailyQuery, token);

        var weeklyQuery = new GetVerbProgressQuery 
        { 
            UserId = request.User.Id,
            Range = ProgressRange.Weekly
        };
        var weeklyResult = await mediator.Send(weeklyQuery, token);

        var message = FormatProgress(dailyResult, weeklyResult);

        await client.SendTextMessageAsync(
            request.UserTelegramId,
            message,
            cancellationToken: token);
    }

    private string FormatProgress(GetVerbProgressResult daily, GetVerbProgressResult weekly)
    {
        if (daily is not GetVerbProgressResult.ProgressReady dailyReady)
            return "⚠️ Ошибка загрузки прогресса";

        if (weekly is not GetVerbProgressResult.WeeklyProgressReady weeklyReady)
            return "⚠️ Ошибка загрузки прогресса";

        var message = $@"📈 Твой прогресс по глаголам

📅 За сегодня:
   • Упражнений: {dailyReady.CardsStudiedToday}
   • Верно: {dailyReady.CorrectAnswers}
   • Точность: {dailyReady.AccuracyPercentage:F1}%
   • Серия: {dailyReady.CurrentStreak}

📊 За неделю:
   • Всего: {weeklyReady.TotalCardsStudied}
   • Верно: {weeklyReady.TotalCorrectAnswers}
   • Точность: {weeklyReady.OverallAccuracy:F1}%

🎯 Продолжай в том же духе!";

        return message;
    }
}