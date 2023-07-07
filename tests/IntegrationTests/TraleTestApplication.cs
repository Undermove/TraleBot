using Application.Common;
using Infrastructure;
using Infrastructure.Monitoring;
using IntegrationTests.Fakes;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Persistence;
using Telegram.Bot;

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
		builder.ConfigureServices(services =>
		{
			// Remove AppDbContext
			var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TraleDbContext>));
			if (descriptor != null) services.Remove(descriptor);
			
			// Add a database context (AppDbContext) using an database from dotnet-testcontainers for testing.
			services.RemoveAll(typeof(ITraleDbContext));
			services.AddDbContext<TraleDbContext>(options =>
				options.UseNpgsql(_connectionString));
			services.AddSingleton<ITraleDbContext>(provider => provider.GetRequiredService<TraleDbContext>() ?? throw new InvalidOperationException());
			
			// Remove TelegramBotClient to test telegram calls
			services.RemoveAll(typeof(ITelegramBotClient));
			services.AddSingleton<ITelegramBotClient, TelegramClientFake>();
			
			// add test bot configuration
			services.RemoveAll(typeof(BotConfiguration));
			services.AddSingleton(new BotConfiguration
			{
				Token = null!,
				HostAddress = null!,
				WebhookToken = "test_token",
				PaymentProviderToken = null!
			});

			services.RemoveAll<IPrometheusResolver>();
			services.AddSingleton<IPrometheusResolver, PrometheusResolverFake>();
		});
		return base.CreateHost(builder);
	}
}