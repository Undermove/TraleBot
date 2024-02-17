using System;
using System.Text.Json.Serialization;
using Application;
using Infrastructure;
using Infrastructure.Monitoring;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Persistence;
using Serilog;
using Serilog.Formatting.Compact;
using Serilog.Sinks.Loki;
using Trale.HostedServices;

var builder = WebApplication.CreateBuilder(args);

const string aspNetCoreEnvironment = "ASPNETCORE_ENVIRONMENT";
string environmentName = Environment.GetEnvironmentVariable(aspNetCoreEnvironment);

builder.Configuration.AddJsonFile("appsettings.json")
        .AddJsonFile($"appsettings.{environmentName}.json", optional: true)
        .AddEnvironmentVariables();

var configuration = builder.Configuration;

builder.Services
    .AddControllers()
    .AddJsonOptions(options=>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .AddNewtonsoftJson();

builder.Services.AddApplication();
builder.Services.AddPersistence(configuration);
        
builder.Services.AddInfrastructure(configuration);
builder.Services.AddHostedService<CreateWebhook>();

builder.Host.UseSerilog((ctx, cfg) =>
{
    cfg.Enrich.WithProperty("Application", ctx.HostingEnvironment.ApplicationName)
        .Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName)
        .ReadFrom.Configuration(configuration)
        .WriteTo.LokiHttp(new NoAuthCredentials("http://loki.loki.svc:3100"))
        .WriteTo.Console(new RenderedCompactJsonFormatter());
});

builder.WebHost.UseUrls("http://*:1402/");
var app = builder.Build();

app.UsePrometheus();
app.UseSerilogRequestLogging();

using (var scope = app.Services.CreateScope())
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
        logger.LogError(ex, "An error occurred while migrating or initializing the database");
    }
}

app.MapControllers();
await app.RunAsync();

// ReSharper disable once ClassNeverInstantiated.Global
public partial class Program { }