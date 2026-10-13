using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Trale.Common;

public static class TrailingSlashRedirect
{
    /// <summary>
    /// Sends <c>/verbs</c> to <c>/verbs/</c> when the web root has a folder of that name with an
    /// <c>index.html</c> — the pages of the static site. The address in <c>Location</c> is relative, so
    /// the browser keeps the scheme and the host it came with: one redirect, whatever the proxy in
    /// front of the application does. Must stand before <c>UseDefaultFiles</c>.
    /// </summary>
    public static IApplicationBuilder UseTrailingSlashRedirect(this IApplicationBuilder app)
    {
        var files = app.ApplicationServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider;
        return app.Use(async (context, next) =>
        {
            var request = context.Request;
            var path = request.Path.Value;
            if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method))
                && !string.IsNullOrEmpty(path) && !path.EndsWith('/')
                && files.GetFileInfo(path + "/index.html") is { Exists: true, IsDirectory: false })
            {
                context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
                context.Response.Headers.Location = request.PathBase + request.Path + "/" + request.QueryString;
                return;
            }

            await next();
        });
    }
}
