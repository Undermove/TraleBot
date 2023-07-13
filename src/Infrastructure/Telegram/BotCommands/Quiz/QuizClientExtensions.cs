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
		var replyMarkup = new List<InlineKeyboardButton>
		{
			InlineKeyboardButton.WithCallbackData("⏭ Пропустить"),
		};

		if (!string.IsNullOrEmpty(quizQuestion.VocabularyEntry.Example))
		{
			replyMarkup.Add(InlineKeyboardButton.WithCallbackData("👀 Показать пример", $"{CommandNames.ShowExample} {quizQuestion.Id}"));
		}
		
		await client.SendTextMessageAsync(
			request.UserTelegramId,
			$"Переведи слово: *{quizQuestion.Question}*",
			ParseMode.Markdown,
			replyMarkup: new InlineKeyboardMarkup(replyMarkup),
			cancellationToken: ct);
	}
}