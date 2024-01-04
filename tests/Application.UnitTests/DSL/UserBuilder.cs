using Domain.Entities;

namespace Application.UnitTests.DSL;

public class UserBuilder
{
    private Guid _userId = Guid.NewGuid();
    private int _telegramId = 123456789;
    private UserAccountType _accountType = UserAccountType.Free;
    private Language _currentLanguage = Language.English;
    private bool _initialLanguageSet;
    private DateTime _subscriptionEndDate;

    public UserBuilder WithPremiumAccountType()
    {
        _accountType = UserAccountType.Premium;
        _subscriptionEndDate = DateTime.UtcNow.AddDays(1);
        return this;
    }
    
    public UserBuilder WithCurrentLanguage(Language language)
    {
        _currentLanguage = language;
        return this;
    }
    
    public UserBuilder WithInitialLanguageSet(bool initialLanguageSet)
    {
        _initialLanguageSet = initialLanguageSet;
        return this;
    }
    
    public User Build()
    {
        var settingsGuid = Guid.NewGuid();
        return new User
        {
            Id = _userId,
            TelegramId = _telegramId,
            AccountType = _accountType,
            InitialLanguageSet = _initialLanguageSet,
            UserSettingsId = settingsGuid,
            Settings = new UserSettings
            {
                Id = settingsGuid,
                UserId = _userId,
                CurrentLanguage = _currentLanguage
            },
            SubscribedUntil = _subscriptionEndDate
        };
    }
}