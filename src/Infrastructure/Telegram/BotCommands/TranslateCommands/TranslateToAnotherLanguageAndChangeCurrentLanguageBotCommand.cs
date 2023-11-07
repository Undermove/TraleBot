using Application.VocabularyEntries.Commands;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using MediatR;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand : IBotCommand
{
    private readonly ITelegramBotClient _client;
    private readonly IMediator _mediator;

    public TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand(ITelegramBotClient client, IMediator mediator)
    {
        _client = client;
        _mediator = mediator;
    }

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(commandPayload.Contains(CommandNames.TranslateToAnotherLanguage));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var command = TranslateInfo.BuildFromRawMessage(request.Text);
        var result = await _mediator.Send(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = request.User ?? throw new ApplicationException("User not registered"),
            Word = command.Word,
            TargetLanguage = command.TargetLanguage
        }, token);
        
        await _client.EditMessageTextAsync(
            request.UserTelegramId,
            request.MessageId,
            "result.Definition",
            cancellationToken: token);
    }
}

public class TranslateInfo
{
    public TranslateInfo(string word, string language, string resultMessageId)
    {
        Word = word;
        TargetLanguage = Enum.Parse<Language>(language); 
        ResultMessageId = resultMessageId;
    }

    public string Word { get; init; }
    public string ResultMessageId { get; init; }
    public Language TargetLanguage { get; set; }

    public static TranslateInfo BuildFromRawMessage(string rawMessage)
    {
        var split = rawMessage.Split('|');
        return new TranslateInfo(split[1], split[2], split[3]);
    }
}