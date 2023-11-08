using Domain.Entities;
using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class ChangeLanguageCallback
{
    public Guid VocabularyEntryId { get; set; }
    public Language TargetLanguage { get; set; }
    
    public static ChangeLanguageCallback BuildFromRawMessage(string message)
    {
        var parts = message.Split('|');
        return new ChangeLanguageCallback
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