using System.Net;
using Application.Common;
using Domain.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Trale.Controllers;

namespace IntegrationTests.Waitlist;

/// <summary>The waitlist form of the public /learn/ pages: an ordinary HTML POST answered with a redirect.</summary>
public class WaitlistFormTests : TestBase
{
    private int _network;

    /// <summary>Sends the form as a browser would; each call comes from its own network address unless one is given.</summary>
    private async Task<HttpResponseMessage> Post(Dictionary<string, string> fields, string? from = null, string? referer = null)
    {
        var client = _testServer.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var request = new HttpRequestMessage(HttpMethod.Post, "/waitlist") { Content = new FormUrlEncodedContent(fields) };
        request.Headers.Add("X-Forwarded-For", from ?? $"203.0.113.{++_network}");
        if (referer != null)
        {
            request.Headers.Referrer = new Uri(referer);
        }

        return await client.SendAsync(request);
    }

    private static Dictionary<string, string> Fields(string email, string lang = "georgian", string platform = "ios") =>
        new() { ["email"] = email, ["lang"] = lang, ["platform"] = platform, ["website"] = "" };

    private async Task<List<WaitlistEntry>> Entries(string email)
    {
        using var scope = _testServer.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ITraleDbContext>().WaitlistEntries
            .AsNoTracking().Where(e => e.Email == email).ToListAsync();
    }

    [Test]
    public async Task An_address_is_put_on_the_list_and_the_person_is_sent_to_the_thank_you_page()
    {
        var response = await Post(Fields(" Anna@Example.com "), referer: "https://tralebot.com/learn/georgian/?src=Expats_Tbilisi");

        response.StatusCode.Should().Be(HttpStatusCode.SeeOther);
        response.Headers.Location!.ToString().Should().Be(WaitlistController.ThanksPath);
        var entry = (await Entries("anna@example.com")).Should().ContainSingle().Subject;
        entry.Language.Should().Be("georgian");
        entry.Platform.Should().Be("ios");
        entry.Source.Should().Be("expats_tbilisi", because: "the tag of the link the page was opened with comes from Referer");
    }

    [Test]
    public async Task The_same_address_twice_is_one_row_per_language()
    {
        await Post(Fields("twice@example.com", platform: "android"));
        await Post(Fields("twice@example.com", platform: "web"));
        await Post(Fields("twice@example.com", lang: "armenian", platform: "web"));

        var entries = await Entries("twice@example.com");
        entries.Select(e => e.Language).Should().BeEquivalentTo(["georgian", "armenian"]);
        entries.Single(e => e.Language == "georgian").Platform.Should().Be("android", because: "the first answer stays");
    }

    [TestCase("not-an-address", "georgian", "ios")]
    [TestCase("bad-language@example.com", "klingon", "ios")]
    [TestCase("bad-platform@example.com", "georgian", "pager")]
    public async Task A_request_the_browser_would_not_send_writes_nothing(string email, string lang, string platform)
    {
        var response = await Post(Fields(email, lang, platform));

        response.StatusCode.Should().Be(HttpStatusCode.SeeOther);
        response.Headers.Location!.ToString().Should().StartWith("/learn/").And.NotBe(WaitlistController.ThanksPath);
        (await Entries(email)).Should().BeEmpty();
    }

    [Test]
    public async Task A_filled_trap_field_looks_like_a_success_and_writes_nothing()
    {
        var fields = Fields("script@example.com");
        fields["website"] = "https://spam.example";

        var response = await Post(fields);

        response.Headers.Location!.ToString().Should().Be(WaitlistController.ThanksPath);
        (await Entries("script@example.com")).Should().BeEmpty();
    }

    [Test]
    public async Task One_network_address_cannot_fill_the_list()
    {
        for (var i = 0; i < WaitlistController.MaxPerAddressPerDay; i++)
        {
            await Post(Fields($"flood{i}@example.com"), from: "198.51.100.7");
        }

        var response = await Post(Fields("flood-over@example.com"), from: "198.51.100.7");

        response.Headers.Location!.ToString().Should().Be(WaitlistController.ThanksPath);
        (await Entries("flood-over@example.com")).Should().BeEmpty();
        (await Entries("flood0@example.com")).Should().ContainSingle();
    }
}
