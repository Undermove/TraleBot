namespace Infrastructure.Auth;

public interface IUserService
{
    bool ValidateCredentials(string? username, string? password);
}