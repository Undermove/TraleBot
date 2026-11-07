using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace IntegrationTests.Site;

/// <summary>A page is checked with the server every time, so after a release it never points at a build that is gone;
/// the build itself, named by its hash, is kept for good.</summary>
public class CacheHeadersTests : TestBase
{
    private const string Folder = "zz-cache-headers-test";
    private const string Build = "index-zzcachetest.js";
    private string _webRoot = null!;

    [SetUp]
    public void CreateFiles()
    {
        _webRoot = _testServer.Services.GetRequiredService<IWebHostEnvironment>().WebRootPath;
        Directory.CreateDirectory(Path.Combine(_webRoot, Folder));
        File.WriteAllText(Path.Combine(_webRoot, Folder, "index.html"), "<!doctype html><title>page</title>");
        Directory.CreateDirectory(Path.Combine(_webRoot, "assets"));
        File.WriteAllText(Path.Combine(_webRoot, "assets", Build), "console.log(1)");
    }

    [TearDown]
    public void RemoveFiles()
    {
        Directory.Delete(Path.Combine(_webRoot, Folder), recursive: true);
        File.Delete(Path.Combine(_webRoot, "assets", Build));
    }

    [Test]
    public async Task A_page_is_checked_every_time()
    {
        var response = await _testServer.CreateClient().GetAsync($"/{Folder}/");

        response.Headers.CacheControl!.NoCache.Should().BeTrue();
    }

    [Test]
    public async Task The_build_is_kept_for_good()
    {
        var response = await _testServer.CreateClient().GetAsync($"/assets/{Build}");

        response.Headers.CacheControl!.ToString().Should().Be("public, max-age=31536000, immutable");
    }
}
