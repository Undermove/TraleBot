using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Application.UnitTests.Tests;

public class RecordAcquisitionSourceServiceTests : CommandTestsBase
{
    private RecordAcquisitionSourceService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new RecordAcquisitionSourceService(Context, NullLoggerFactory.Instance);
    }

    [Test]
    public async Task Records_source_on_first_touch()
    {
        var user = await CreateFreeUser();
        user.AcquisitionSource = null;
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(user.Id, "site", CancellationToken.None);

        result.ShouldBe(RecordAcquisitionSourceResult.Recorded);
        Context.Users.First(u => u.Id == user.Id).AcquisitionSource.ShouldBe("site");
    }

    [Test]
    public async Task Does_not_overwrite_existing_source()
    {
        var user = await CreateFreeUser();
        user.AcquisitionSource = "channel_neuralfordevs";
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(user.Id, "site", CancellationToken.None);

        result.ShouldBe(RecordAcquisitionSourceResult.AlreadySet);
        Context.Users.First(u => u.Id == user.Id).AcquisitionSource.ShouldBe("channel_neuralfordevs");
    }

    [Test]
    public async Task Rejects_malformed_tag_and_leaves_source_null()
    {
        var user = await CreateFreeUser();
        user.AcquisitionSource = null;
        await Context.SaveChangesAsync();

        var result = await _sut.ExecuteAsync(user.Id, "drop table users;", CancellationToken.None);

        result.ShouldBe(RecordAcquisitionSourceResult.InvalidSource);
        Context.Users.First(u => u.Id == user.Id).AcquisitionSource.ShouldBeNull();
    }

    [TestCase("Site", "site")]                       // lower-cased
    [TestCase("  channel_x  ", "channel_x")]         // trimmed
    [TestCase("post-2026_06", "post-2026_06")]       // allowed punctuation
    public void Sanitize_normalizes_valid_tags(string raw, string expected)
    {
        RecordAcquisitionSourceService.Sanitize(raw).ShouldBe(expected);
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase(null)]
    [TestCase("has space")]
    [TestCase("emoji🚀")]
    [TestCase("with/slash")]
    public void Sanitize_rejects_invalid_tags(string? raw)
    {
        RecordAcquisitionSourceService.Sanitize(raw).ShouldBeNull();
    }

    [Test]
    public void Sanitize_rejects_overlong_tag()
    {
        var tooLong = new string('a', 65);
        RecordAcquisitionSourceService.Sanitize(tooLong).ShouldBeNull();
    }
}
