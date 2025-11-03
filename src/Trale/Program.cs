using System;
using System.IO;
using System.Text.Json.Serialization;
using System.Threading;
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
using Trale.Common;
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
builder.Services.AddHostedService<IdempotencyCleanupService>();

builder.WebHost.UseUrls("http://*:1402/");
var app = builder.Build();

app.UsePrometheus();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    try
    {
        var botDbContext = services.GetRequiredService<TraleDbContext>();
        await botDbContext.Database.MigrateAsync();
        
        // Load Georgian verbs data
        var loaderService = services.GetRequiredService<Infrastructure.GeorgianVerbs.IVerbDataLoaderService>();
        var verbsJsonPath = Path.Combine(AppContext.BaseDirectory, "geogian-verbs.json");
        await loaderService.LoadVerbDataAsync(verbsJsonPath, botDbContext, CancellationToken.None);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating or initializing the database");
    }
}

app.UseMiddleware<ExceptionsMiddleware>();

app.MapControllers();
await app.RunAsync();

// ReSharper disable once ClassNeverInstantiated.Global
public partial class Program { }