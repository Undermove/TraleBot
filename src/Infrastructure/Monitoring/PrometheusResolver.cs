using Microsoft.AspNetCore.Builder;
using Prometheus.Client.AspNetCore;
using Prometheus.Client.HttpRequestDurations;

namespace Infrastructure.Monitoring;

class PrometheusResolver : IPrometheusResolver
{	
	public void UsePrometheus(IApplicationBuilder app)
	{
		app.UsePrometheusServer();
		app.UsePrometheusRequestDurations();
	}
}