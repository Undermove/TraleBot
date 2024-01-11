using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Monitoring;

public static class PrometheusStartup
{
    public static void UsePrometheus(this WebApplication app)
    {
        // we need to turn off prometheus server during tests so we resolve it here and in tests we resolve a fake
        var resolver = app.Services.GetRequiredService<IPrometheusResolver>();
        resolver.UsePrometheus(app);
    }
}