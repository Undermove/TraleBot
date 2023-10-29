using Domain.Entities;

namespace Application.UnitTests.DSL;

public class UserBuilder
{
    private Guid _userId = Guid.NewGuid();
    private int _telegramId = 123456789;
    private UserAccountType _accountType = UserAccountType.Free;
    private Language _currentLanguage = Language.English;
    
    public UserBuilder WithPremiumAccountType()
    {
        _accountType = UserAccountType.Premium;
        return this;
    }
    
    public UserBuilder WithCurrentLanguage(Language language)
    {
        _currentLanguage = language;
        return this;
    }
    
    public User Build()
    {
        return new User
        {
            Id = _userId,
            TelegramId = _telegramId,
            AccountType = _accountType,
            Settings = new UserSettings
            {
                Id = Guid.NewGuid(),
                UserId = _userId,
                CurrentLanguage = _currentLanguage
            }
        };
    }
}