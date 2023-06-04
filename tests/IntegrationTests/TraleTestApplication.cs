using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Persistence;

namespace IntegrationTests;

public class TraleTestApplication : WebApplicationFactory<Program>
{
	private readonly string _connectionString;

	public TraleTestApplication(string connectionString)
	{
		_connectionString = connectionString;
	}

	protected override IHost CreateHost(IHostBuilder builder)
	{
		
		builder.ConfigureServices(collection =>
		{
			// Remove AppDbContext
			var descriptor = collection.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TraleDbContext>));
			if (descriptor != null) collection.Remove(descriptor);

			collection.AddDbContext<TraleDbContext>(options =>
				options.UseNpgsql(_connectionString));
		});
		return base.CreateHost(builder);
	}
}