using System;
using System.Text.Json.Serialization;
using Application;
using Infrastructure;
using Infrastructure.Auth;
using Infrastructure.Monitoring;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi.Models;
using Persistence;
using Serilog;
using Serilog.Sinks.Elasticsearch;
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

        // services.AddSwaggerGen(c =>  
        // {  
        //     c.SwaggerDoc("v1", new OpenApiInfo { Title = "BasicAuth", Version = "v1" });  
        //     c.AddSecurityDefinition("basic", new OpenApiSecurityScheme  
        //     {  
        //         Name = "Authorization",  
        //         Type = SecuritySchemeType.Http,  
        //         Scheme = "basic",  
        //         In = ParameterLocation.Header,  
        //         Description = "Basic Authorization header using the Bearer scheme."  
        //     });  
        //     c.AddSecurityRequirement(new OpenApiSecurityRequirement  
        //     {  
        //         {  
        //             new OpenApiSecurityScheme  
        //             {  
        //                 Reference = new OpenApiReference  
        //                 {  
        //                     Type = ReferenceType.SecurityScheme,  
        //                     Id = "basic"  
        //                 }  
        //             },  
        //             new string[] {}  
        //         }  
        //     });  
        // });

        var authConfig = Configuration.GetSection("AuthConfiguration").Get<AuthConfiguration>();
        services.AddSingleton(authConfig);
        services.AddAuthentication("BasicAuthentication")  
            .AddScheme<AuthenticationSchemeOptions, BasicAuthenticationHandler>("BasicAuthentication", null);  
  
        services.AddScoped<IUserService, UserService>();
        services.AddApplication();
        services.AddPersistence(Configuration);
        
        services.AddInfrastructure(Configuration);
        services.AddHostedService<CreateWebhook>();
    }

    // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
    {
        var logger = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri("http://localhost:9200")) {
                AutoRegisterTemplate = true,
                IndexFormat = "tralebot-logs-{0:yyyy.MM.dd}"
            })
            .CreateLogger();
        loggerFactory.AddSerilog(logger);
        PrometheusStartup.UsePrometheus(app);
        
        app.UseMiddleware<ExceptionsMiddleware>();
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        // app.UseDeveloperExceptionPage();
        // app.UseSwagger();
        // app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Trale v1"));

        app.UseRouting();

        app.UseAuthentication();  
        app.UseAuthorization();
        app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
    }
}