using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.VocabularyEntries.Commands;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class RemoveVocabularyEntryCommandTests : CommandTestsBase
{
    private User _existingUser = null!;
    private RemoveVocabularyEntry.Handler _sut = null!;
    private Mock<IAchievementsService> _achievementsService = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _achievementsService = mockRepository.Create<IAchievementsService>();
        _achievementsService
            .Setup(s => s.AssignAchievements(It.IsAny<RemoveWordTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _existingUser = Create.User().Build();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();

        _sut = new RemoveVocabularyEntry.Handler(Context, _achievementsService.Object);
    }

    [Test]
    public async Task ShouldRemoveEntryFromDatabase()
    {
        var entry = Create.VocabularyEntry().WithUser(_existingUser).Build();
        Context.VocabularyEntries.Add(entry);
        await Context.SaveChangesAsync();

        await _sut.Handle(new RemoveVocabularyEntry { VocabularyEntryId = entry.Id }, CancellationToken.None);

        var remaining = await Context.VocabularyEntries.FindAsync(entry.Id);
        remaining.ShouldBeNull();
    }

    [Test]
    public async Task ShouldBeNoOpWhenEntryDoesNotExist()
    {
        var nonExistentId = Guid.NewGuid();

        // Should not throw
        await _sut.Handle(new RemoveVocabularyEntry { VocabularyEntryId = nonExistentId }, CancellationToken.None);
    }

    [Test]
    public async Task ShouldNotRemoveOtherUsersEntries()
    {
        var otherUser = Create.User().Build();
        Context.Users.Add(otherUser);
        var ownersEntry = Create.VocabularyEntry().WithUser(_existingUser).Build();
        var otherEntry = Create.VocabularyEntry().WithUser(otherUser).Build();
        Context.VocabularyEntries.AddRange(ownersEntry, otherEntry);
        await Context.SaveChangesAsync();

        await _sut.Handle(new RemoveVocabularyEntry { VocabularyEntryId = ownersEntry.Id }, CancellationToken.None);

        var remainingOther = await Context.VocabularyEntries.FindAsync(otherEntry.Id);
        remainingOther.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldTriggerAchievementAfterRemoval()
    {
        var entry = Create.VocabularyEntry().WithUser(_existingUser).Build();
        Context.VocabularyEntries.Add(entry);
        await Context.SaveChangesAsync();

        await _sut.Handle(new RemoveVocabularyEntry { VocabularyEntryId = entry.Id }, CancellationToken.None);

        _achievementsService.Verify(
            s => s.AssignAchievements(It.IsAny<RemoveWordTrigger>(), _existingUser.Id, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
