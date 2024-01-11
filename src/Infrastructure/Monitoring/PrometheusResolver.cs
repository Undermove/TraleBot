using Microsoft.AspNetCore.Builder;

namespace Infrastructure.Monitoring;

class PrometheusResolver : IPrometheusResolver
{	
	public void UsePrometheus(WebApplication app)
	{
		app.MapPrometheusScrapingEndpoint();
	}
}