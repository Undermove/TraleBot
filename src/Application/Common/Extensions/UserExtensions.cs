using Domain.Entities;

namespace Application.Common.Extensions;

public static class UserExtensions
{
    public static bool IsActivePremium(this User user)
    {
        return user.AccountType == UserAccountType.Premium && user.SubscribedUntil!.Value.Date > DateTime.UtcNow;
    }
}