using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Persistence;

namespace IntegrationTests;

public class NotificationsMigrationTests : TestBase
{
    [Test]
    public async Task Migration_AddNotificationTriggerAndNotificationsEnabled_AppliesCleanly()
    {
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TraleDbContext>();

        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();

        // Verify NotificationsEnabled column exists in Users table
        using var cmdUsers = connection.CreateCommand();
        cmdUsers.CommandText = """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'Users'
              AND column_name = 'NotificationsEnabled'
            """;
        var usersResult = await cmdUsers.ExecuteScalarAsync();
        usersResult.Should().NotBeNull("NotificationsEnabled column must exist in Users table after migration");

        // Verify NotificationTriggers table exists
        using var cmdTable = connection.CreateCommand();
        cmdTable.CommandText = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'NotificationTriggers'
            """;
        var tableResult = await cmdTable.ExecuteScalarAsync();
        tableResult.Should().NotBeNull("NotificationTriggers table must exist after migration");
    }
}
