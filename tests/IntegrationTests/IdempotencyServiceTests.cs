using Application.Common;
using Application.Common.Interfaces;
using Domain.Entities;
using FluentAssertions;
using IntegrationTests.DSL;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace IntegrationTests;

public class IdempotencyServiceTests : TestBase
{
    [Test]
    public async Task ProcessCommand_WithDuplicateUpdateId_ShouldProcessOnlyOnce()
    {
        // Arrange
        var updateId = 12345;
        var userTelegramId = 123456L;
        
        using var scope = _testServer.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var dialogProcessor = scope.ServiceProvider.GetRequiredService<IDialogProcessor>();
        
        var user = Create.User(userTelegramId, "Test");
        await database.Users.AddAsync(user);
        await database.SaveChangesAsync(CancellationToken.None);

        var update = Create.TelegramUpdate(updateId, userTelegramId);

        // Act - Process the same update twice
        await dialogProcessor.ProcessCommand(update, CancellationToken.None);
        await dialogProcessor.ProcessCommand(update, CancellationToken.None);

        // Assert - Check that only one processed update record exists
        var processedUpdates = await database.ProcessedUpdates
            .Where(x => x.UpdateId == updateId)
            .ToListAsync();

        processedUpdates.Should().HaveCount(1);
        processedUpdates[0].UserTelegramId.Should().Be(userTelegramId);
        processedUpdates[0].RequestType.Should().Be(UpdateType.Message.ToString());
        processedUpdates[0].Text.Should().Be("/start");
    }

    [Test]
    public async Task IdempotencyService_IsRequestProcessedAsync_ShouldReturnCorrectStatus()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
        var updateId = 54321;

        // Act & Assert - Initially should not be processed
        var isProcessedBefore = await idempotencyService.IsRequestProcessedAsync(updateId);
        isProcessedBefore.Should().BeFalse();

        // Mark as processed
        await idempotencyService.MarkRequestAsProcessedAsync(updateId, 123L, "Message", "test", CancellationToken.None);

        // Should now be processed
        var isProcessedAfter = await idempotencyService.IsRequestProcessedAsync(updateId);
        isProcessedAfter.Should().BeTrue();
    }

    [Test]
    public async Task TryMarkRequestAsProcessedAsync_WithNewUpdateId_ShouldReturnTrue()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
        var database = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var updateId = 11111;

        // Act
        var result = await idempotencyService.TryMarkRequestAsProcessedAsync(
            updateId, 777L, "Message", "test", CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        
        // Verify record was created
        var record = await database.ProcessedUpdates.FirstOrDefaultAsync(x => x.UpdateId == updateId);
        record.Should().NotBeNull();
        record!.UserTelegramId.Should().Be(777L);
    }

    [Test]
    public async Task TryMarkRequestAsProcessedAsync_WithDuplicateUpdateId_ShouldReturnFalse()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
        var database = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var updateId = 22222;

        // First call should succeed
        var firstResult = await idempotencyService.TryMarkRequestAsProcessedAsync(
            updateId, 777L, "Message", "test", CancellationToken.None);

        // Act - Second call with same updateId should fail
        var secondResult = await idempotencyService.TryMarkRequestAsProcessedAsync(
            updateId, 888L, "Message", "test2", CancellationToken.None);

        // Assert
        firstResult.Should().BeTrue();
        secondResult.Should().BeFalse();
        
        // Verify only one record exists
        var records = await database.ProcessedUpdates.Where(x => x.UpdateId == updateId).ToListAsync();
        records.Should().HaveCount(1);
        records[0].UserTelegramId.Should().Be(777L); // First request data should be preserved
    }

    [Test]
    public async Task ProcessCommand_WithConcurrentRequests_ShouldProcessOnlyOnce()
    {
        // Arrange
        var updateId = 33333;
        var userTelegramId = 123456L;
        
        using var scope = _testServer.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        
        var user = Create.User(userTelegramId, "Test");
        await database.Users.AddAsync(user);
        await database.SaveChangesAsync(CancellationToken.None);

        var update = Create.TelegramUpdate(updateId, userTelegramId);

        // Act - Simulate concurrent requests by creating multiple scopes
        var tasks = new List<Task>();
        for (int i = 0; i < 5; i++)
        {
            tasks.Add(Task.Run(async () => 
            {
                using var taskScope = _testServer.Services.CreateScope();
                var dialogProcessor = taskScope.ServiceProvider.GetRequiredService<IDialogProcessor>();
                await dialogProcessor.ProcessCommand(update, CancellationToken.None);
            }));
        }

        await Task.WhenAll(tasks);

        // Assert - Only one processed update record should exist
        var processedUpdates = await database.ProcessedUpdates
            .Where(x => x.UpdateId == updateId)
            .ToListAsync();

        processedUpdates.Should().HaveCount(1);
        processedUpdates[0].UserTelegramId.Should().Be(userTelegramId);
    }

    [Test]
    public async Task IdempotencyService_WithLongText_ShouldTruncateText()
    {
        // Arrange
        using var scope = _testServer.Services.CreateScope();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
        var database = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
        var updateId = 44444;
        var longText = new string('A', 1500); // Text longer than 1000 chars

        // Act
        var result = await idempotencyService.TryMarkRequestAsProcessedAsync(
            updateId, 999L, "Message", longText, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        
        var record = await database.ProcessedUpdates.FirstOrDefaultAsync(x => x.UpdateId == updateId);
        record.Should().NotBeNull();
        record!.Text.Length.Should().Be(1000);
        record.Text.Should().Be(new string('A', 1000));
    }
}