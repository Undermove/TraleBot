using Domain.Entities;

namespace Application.UnitTests.Common;

public static class Create
{
    public static User TestUser()
    {
        return new User
        {
            Id = Guid.NewGuid(),
            TelegramId = 123456789,
        };
    }  
}