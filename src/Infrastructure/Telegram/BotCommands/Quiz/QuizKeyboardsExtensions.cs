using Domain.Entities;
using Infrastructure.Telegram.Models;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

internal static class QuizKeyboardsExtensions
{
	internal static Task SendQuizQuestion(this ITelegramBotClient client, TelegramRequest request, QuizQuestion quizQuestion, CancellationToken ct)
	{
		return quizQuestion switch
		{
			QuizQuestionWithTypeAnswer answer => SendQuizWithTypeAnswer(client, request, answer, ct),
			QuizQuestionWithVariants variants => SendQuizWithVariants(client, request, variants, ct),
			_ => throw new ArgumentException("Invalid type of quiz question")
		};
	}

	private static async Task SendQuizWithVariants(ITelegramBotClient client, TelegramRequest request, QuizQuestionWithVariants quizQuestion, CancellationToken ct)
	{
		var variantButtons = quizQuestion.Variants
			.Select(v => new KeyboardButton(v))
			.ToList();

		var keyboardRows = new List<List<KeyboardButton>>
		{
			new()
			{
				variantButtons[0],
				variantButtons[1]
			},
			new()
			{
				variantButtons[2],
				variantButtons[3]
			},
			new()
			{
				new($"{CommandNames.StopQuizIcon} Закончить квиз")
			}
		};
		
		ReplyKeyboardMarkup keyboard = new ReplyKeyboardMarkup(keyboardRows);
		
		await client.SendTextMessageAsync(
			request.UserTelegramId,
			$"Переведи слово: *{quizQuestion.Question}*",
			ParseMode.Markdown,
			replyMarkup: keyboard,
			cancellationToken: ct);
	}

	private static async Task SendQuizWithTypeAnswer(ITelegramBotClient client, TelegramRequest request, QuizQuestionWithTypeAnswer quizQuestion, CancellationToken ct)
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
			"Введи перевод слова:",
			replyMarkup: new ReplyKeyboardRemove(),
			cancellationToken: ct);
		
		await client.SendTextMessageAsync(
			request.UserTelegramId,
			$"*{quizQuestion.Question}*",
			ParseMode.Markdown,
			replyMarkup: keyboard,
			cancellationToken: ct);
	}
}