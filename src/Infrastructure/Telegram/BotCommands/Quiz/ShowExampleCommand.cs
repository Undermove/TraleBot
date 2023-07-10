using Application.Quizzes.Commands;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.BotCommands.Quiz;

public class ShowExampleCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public ShowExampleCommand(
        ITelegramBotClient client, 
        IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.StartsWith(CommandNames.ShowExample, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithCallbackData("⏭ Пропустить") },
        });
        
        await _client.EditMessageReplyMarkupAsync(
            request.UserTelegramId,
            request.MessageId,
            replyMarkup: keyboard,
            cancellationToken: token
        );
        
        //var quizQuestion = await _mediator.Send(new GetCurrentQuizQuestionQuery { UserId = request.User!.Id }, token);
        
        await _client.EditMessageTextAsync(request.UserTelegramId, 
            request.MessageId,
            $"Переведи:" +
            $"\r\nПример использования:",
            replyMarkup: keyboard,
            cancellationToken:token 
        );
    }
}