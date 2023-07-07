using Infrastructure.Monitoring;
using Microsoft.AspNetCore.Builder;

namespace IntegrationTests.Fakes;

public class PrometheusResolverFake : IPrometheusResolver
{
	public void UsePrometheus(IApplicationBuilder app)
	{
		// do nothing
	}
}