using Microsoft.AspNetCore.Builder;
using Prometheus.Client.AspNetCore;
using Prometheus.Client.HttpRequestDurations;

namespace Infrastructure.Monitoring;

public static class PrometheusStartup
{
    public static void UsePrometheus(IApplicationBuilder app)
    {
        app.UsePrometheusServer();
        app.UsePrometheusRequestDurations();
    }
}