using Domain.Entities;
using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateToAnotherLanguageCallback
{
    public Guid VocabularyEntryId { get; set; }
    public Language TargetLanguage { get; set; }
    
    public static TranslateToAnotherLanguageCallback BuildFromRawMessage(string message)
    {
        var parts = message.Split('|');
        return new TranslateToAnotherLanguageCallback
        {
            VocabularyEntryId = Guid.Parse(parts[2]),
            TargetLanguage = (Language)int.Parse(parts[1])
        };
    }

    public string ToStringCallback()
    {
        return $"{CommandNames.TranslateToAnotherLanguage}|{(int)TargetLanguage}|{VocabularyEntryId}";
    }
}