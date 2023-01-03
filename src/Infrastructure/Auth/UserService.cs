namespace Infrastructure.Auth;

public class UserService : IUserService  
{
    private readonly AuthConfiguration _config;

    public UserService(AuthConfiguration config)
    {
        _config = config;
    }
    
    public bool ValidateCredentials(string? username, string? password)
    {
        if (password == null)
        {
            return false;
        }
        
        return username != null && username.Equals(_config.User) && password.Equals(_config.Password);  
    }  
}