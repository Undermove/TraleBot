using System.Text.Json.Serialization;
using Application;
using Infrastructure;
using Infrastructure.Monitoring;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Persistence;
using Serilog;
using Trale.Common;
using Trale.HostedServices;

namespace Trale;

public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; }

    // This method gets called by the runtime. Use this method to add services to the container.
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers()
            .AddJsonOptions(options=>
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .AddNewtonsoftJson();

        services.AddApplication();
        services.AddPersistence(Configuration);
        
        services.AddInfrastructure(Configuration);
        services.AddHostedService<CreateWebhook>();
    }

    // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
    {
        PrometheusStartup.UsePrometheus(app);
        
        app.UseMiddleware<ExceptionsMiddleware>();
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseRouting();
        
        app.UseSerilogRequestLogging();
        
        app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
    }
}