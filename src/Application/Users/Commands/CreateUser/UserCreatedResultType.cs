using Domain.Entities;

namespace Application.Users.Commands.CreateUser;

public enum UserCreatedResultType
{
    Success,
    UserAlreadyExists,
}

public record UserCreated(User User);
public record UserExists(User User);
