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
		await client.SendTextMessageAsync(
			request.UserTelegramId,
			$"Переведи слово: *{quizQuestion.Question}*",
			ParseMode.Markdown,
			replyMarkup: new InlineKeyboardMarkup(new []{
				InlineKeyboardButton.WithCallbackData("⏭ Пропустить"), 
				//InlineKeyboardButton.WithCallbackData("👀 Показать пример", "/showExample"),
			}),
			cancellationToken: ct);
	}
}