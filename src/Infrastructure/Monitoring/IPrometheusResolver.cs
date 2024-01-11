using Microsoft.AspNetCore.Builder;

namespace Infrastructure.Monitoring;

public interface IPrometheusResolver
{
	void UsePrometheus(WebApplication app);
}