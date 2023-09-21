using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public static class QuizClientExtensions
{
	internal static async Task SendQuizQuestion(this ITelegramBotClient client, TelegramRequest request, QuizQuestion quizQuestion, CancellationToken ct)
	{
		InlineKeyboardMarkup keyboard = new InlineKeyboardMarkup(new[]
		{
			new []
			{
				InlineKeyboardButton.WithCallbackData("⏩ Пропустить"),
			},
			new []
			{
				InlineKeyboardButton.WithCallbackData($"{CommandNames.StopQuizIcon} Закончить квиз", $"{CommandNames.StopQuiz}"),
			}
		});

		if (!string.IsNullOrEmpty(quizQuestion.VocabularyEntry.Example))
		{
			keyboard = new InlineKeyboardMarkup(new[]
			{
				new []
				{
					InlineKeyboardButton.WithCallbackData("⏭ Пропустить"),
				},
				new []
				{
					InlineKeyboardButton.WithCallbackData("👀 Показать пример", $"{CommandNames.ShowExample} {quizQuestion.Id}")
				},
				new []
				{
					InlineKeyboardButton.WithCallbackData($"{CommandNames.StopQuizIcon} Закончить квиз", $"{CommandNames.StopQuiz}"),
				}
			});
		}
		
		await client.SendTextMessageAsync(
			request.UserTelegramId,
			$"Переведи слово: *{quizQuestion.Question}*",
			ParseMode.Markdown,
			replyMarkup: keyboard,
			cancellationToken: ct);
	}
}