using Application.Common;
using Infrastructure.Monitoring;
using Infrastructure.Telegram;
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
	private readonly Action<IServiceCollection>? _configure;

	/// <param name="configure">Last word on the services — runs after the test defaults below.</param>
	public TraleTestApplication(string connectionString, Action<IServiceCollection>? configure = null)
	{
		_connectionString = connectionString;
		_configure = configure;
	}

	protected override IHost CreateHost(IHostBuilder builder)
	{
		builder.ConfigureServices(services =>
		{
			// Remove AppDbContext
			var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TraleDbContext>));
			if (descriptor != null) services.Remove(descriptor);

			// Add a database context (AppDbContext) using a database from dotnet-testcontainers for testing.
			services.AddDbContext<ITraleDbContext, TraleDbContext>(options =>
				options.UseNpgsql(_connectionString));

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
				PaymentProviderToken = null!,
				BotName = "traletestmock_bot"
			});

			services.RemoveAll<IPrometheusResolver>();
			services.AddSingleton<IPrometheusResolver, PrometheusResolverFake>();

			_configure?.Invoke(services);
		});
		return base.CreateHost(builder);
	}
}