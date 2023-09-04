using Domain.Entities;

namespace Application.UnitTests.DSL;

public class UserBuilder
{
    private Guid _userId = Guid.NewGuid();
    private int _telegramId = 123456789;
    private UserAccountType _accountType = UserAccountType.Free;
    
    public UserBuilder WithPremiumAccountType()
    {
        _accountType = UserAccountType.Premium;
        return this;
    }
    
    public User Build()
    {
        return new User
        {
            Id = _userId,
            TelegramId = _telegramId,
            AccountType = _accountType
        };
    }
}