using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Auth;

public class BasicAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>  
{  
    readonly IUserService _userService;  

    public BasicAuthenticationHandler(IUserService userService,  
        IOptionsMonitor<AuthenticationSchemeOptions> options,  
        ILoggerFactory logger,  
        UrlEncoder encoder,  
        ISystemClock clock)  
        : base(options, logger, encoder, clock)  
    {
        _userService = userService;  
    }  
  
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()  
    {  
        string? username;  
        try
        {
            var authHeader = AuthenticationHeaderValue.Parse(Request.Headers["Authorization"]);
            if (authHeader.Parameter == null)
            {
                return Task.FromResult(AuthenticateResult.Fail("Authentication failed"));
            }

            var credentials = Encoding.UTF8.GetString(Convert.FromBase64String(authHeader.Parameter)).Split(':');
            username = credentials.FirstOrDefault();
            var password = credentials.LastOrDefault();

            if (!_userService.ValidateCredentials(username, password))
                throw new ArgumentException("Invalid credentials");
        }  
        catch (Exception ex)  
        {  
            return Task.FromResult(AuthenticateResult.Fail($"Authentication failed: {ex.Message}"));  
        }

        if (username == null)
        {
            return Task.FromResult(AuthenticateResult.Fail($"Authentication failed"));
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, username)
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}