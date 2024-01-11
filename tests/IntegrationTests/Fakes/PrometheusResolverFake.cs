using Infrastructure.Monitoring;
using Microsoft.AspNetCore.Builder;

namespace IntegrationTests.Fakes;

public class PrometheusResolverFake : IPrometheusResolver
{
	public void UsePrometheus(WebApplication app)
	{
		// do nothing
	}
}