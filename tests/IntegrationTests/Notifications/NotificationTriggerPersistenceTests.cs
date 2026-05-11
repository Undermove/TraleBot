using Application.Common;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace IntegrationTests.Notifications;

public class NotificationTriggerPersistenceTests : TestBase
{
    [Test]
    public async Task NotificationTrigger_CanBeSavedAndRetrievedFromDb()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(900001L, "TriggerUser");
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync(CancellationToken.None);

        var trigger = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = NotificationSource.Holiday,
            LastSentAt = null,
            NextStreakMilestone = 7,
        };

        await db.NotificationTriggers.AddAsync(trigger);
        await db.SaveChangesAsync(CancellationToken.None);

        // Act
        var loaded = await db.NotificationTriggers
            .FirstOrDefaultAsync(t => t.Id == trigger.Id);

        // Assert
        loaded.Should().NotBeNull();
        loaded!.UserId.Should().Be(user.Id);
        loaded.Source.Should().Be(NotificationSource.Holiday);
        loaded.LastSentAt.Should().BeNull();
        loaded.NextStreakMilestone.Should().Be(7);
    }

    [Test]
    public async Task InsertDuplicateTrigger_ViolatesUniqueConstraint()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(900002L, "DupUser");
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync(CancellationToken.None);

        var trigger1 = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = NotificationSource.Coins,
        };
        await db.NotificationTriggers.AddAsync(trigger1);
        await db.SaveChangesAsync(CancellationToken.None);

        var trigger2 = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = NotificationSource.Coins,
        };
        await db.NotificationTriggers.AddAsync(trigger2);

        // Act & Assert
        var act = async () => await db.SaveChangesAsync(CancellationToken.None);
        await act.Should().ThrowAsync<Exception>();
    }

    [Test]
    public async Task SaveTwoTriggersForSameUserAndSource_ThrowsUniqueConstraintViolation()
    {
        // Arrange — same as InsertDuplicateTrigger but with Streak source to keep isolation
        using var scope = _testServer.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();

        var user = Create.User(900003L, "DupUser2");
        await db.Users.AddAsync(user);
        await db.SaveChangesAsync(CancellationToken.None);

        var first = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = NotificationSource.Streak,
        };
        await db.NotificationTriggers.AddAsync(first);
        await db.SaveChangesAsync(CancellationToken.None);

        var second = new NotificationTrigger
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Source = NotificationSource.Streak,
        };
        await db.NotificationTriggers.AddAsync(second);

        // Act & Assert
        var act = async () => await db.SaveChangesAsync(CancellationToken.None);
        await act.Should().ThrowAsync<Exception>();
    }
}
