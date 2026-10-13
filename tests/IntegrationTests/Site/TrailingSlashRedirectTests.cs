using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Site;

/// <summary>A page of the static site asked for without the closing slash is one redirect away, and the redirect names no scheme.</summary>
public class TrailingSlashRedirectTests : TestBase
{
    private const string Folder = "zz-trailing-slash-test";
    private string _folderPath = null!;

    [SetUp]
    public void CreatePage()
    {
        var webRoot = _testServer.Services.GetRequiredService<IWebHostEnvironment>().WebRootPath;
        _folderPath = Path.Combine(webRoot, Folder);
        Directory.CreateDirectory(_folderPath);
        File.WriteAllText(Path.Combine(_folderPath, "index.html"), "<!doctype html><title>page</title>");
    }

    [TearDown]
    public void RemovePage() => Directory.Delete(_folderPath, recursive: true);

    private HttpClient Client() => _testServer.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Test]
    public async Task A_folder_without_the_slash_is_redirected_with_a_relative_address()
    {
        var response = await Client().GetAsync($"/{Folder}?src=test");

        response.StatusCode.Should().Be(HttpStatusCode.MovedPermanently);
        response.Headers.Location!.OriginalString.Should().Be($"/{Folder}/?src=test",
            because: "an absolute address would carry the scheme the application sees behind the proxy — http");
    }

    [Test]
    public async Task The_folder_with_the_slash_is_the_page()
    {
        var response = await Client().GetAsync($"/{Folder}/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).Should().Contain("<title>page</title>");
    }

    [Test]
    public async Task What_is_not_a_page_folder_is_left_alone()
    {
        (await Client().GetAsync("/healthz")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Client().GetAsync("/no-such-folder")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
