using Application.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;

namespace IntegrationTests;

public class WinBackMigrationTests : TestBase
{
    [Test]
    public async Task Migration_AddWinBackSentAtUtcToUser_AppliesCleanly()
    {
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();

        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Users'
              AND column_name = 'WinBackSentAtUtc'
            """;

        var result = await cmd.ExecuteScalarAsync();

        result.Should().NotBeNull("WinBackSentAtUtc column must exist in Users table after migration");
        result!.ToString().Should().Be("YES", "WinBackSentAtUtc must be nullable");
    }
}
