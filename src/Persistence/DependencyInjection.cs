using Application.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Persistence;

public static class DependencyInjection
{
    public static void AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<TraleDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("TraleBotDb")));

        services.AddScoped<ITraleDbContext>(provider => provider.GetService<TraleDbContext>() ?? throw new InvalidOperationException());
        services.AddHealthChecks().AddDbContextCheck<TraleDbContext>();
    }
}