using Domain.Entities;
using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageCallback
{
    public string CommandName => CommandNames.TranslateToAnotherLanguage;
    public required Guid VocabularyEntryId { get; init; }
    public required Language TargetLanguage { get; init; }
}