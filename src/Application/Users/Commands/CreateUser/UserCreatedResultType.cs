using Domain.Entities;

namespace Application.Users.Commands.CreateUser;

public record UserCreated(User User);
public record UserExists(User User);
