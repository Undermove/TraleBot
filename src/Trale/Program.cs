using System;
using System.Text.Json.Serialization;
using Application;
using Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Persistence;
using Trale.HostedServices;

var hostBuilder = WebApplication.CreateBuilder(args);

// Setup Bot configuration
const string aspNetCoreEnvironment = "ASPNETCORE_ENVIRONMENT";
string environmentName = Environment.GetEnvironmentVariable(aspNetCoreEnvironment);

hostBuilder.WebHost.ConfigureAppConfiguration((_, config) =>
{
    config.AddJsonFile("appsettings.json")
        .AddJsonFile($"appsettings.{environmentName}.json", optional: true)
        .AddEnvironmentVariables();
});

var configuration = hostBuilder.Configuration;

hostBuilder.Services
    .AddControllers()
    .AddJsonOptions(options=>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .AddNewtonsoftJson();

hostBuilder.Services.AddApplication();
hostBuilder.Services.AddPersistence(configuration);
        
hostBuilder.Services.AddInfrastructure(configuration);
hostBuilder.Services.AddHostedService<CreateWebhook>();

hostBuilder.WebHost.UseUrls("http://*:1402/");
var host = hostBuilder.Build();

using (var scope = host.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    try
    {
        var botDbContext = services.GetRequiredService<TraleDbContext>();
        await botDbContext.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating or initializing the database.");
    }
}

host.MapControllers();
await host.RunAsync();