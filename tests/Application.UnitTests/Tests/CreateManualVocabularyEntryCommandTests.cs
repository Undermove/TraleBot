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

public class CreateManualVocabularyEntryCommandTests : CommandTestsBase
{
    private User _existingUser = null!;
    private CreateManualTranslation.Handler _createVocabularyEntryCommandHandler = null!;
    private Mock<IAchievementsService> _achievementsService = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _achievementsService = mockRepository.Create<IAchievementsService>();
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<ManualTranslationTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<VocabularyCountTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _existingUser = Create.User().Build();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new CreateManualTranslation.Handler(Context, _achievementsService.Object);
    }

    [Test]
    public async Task ShouldSaveManualDefinitionWhenItComes()
    {
        const string expectedWord = "cat";
        const string expectedDefinition = "кошка";

        var result = await _createVocabularyEntryCommandHandler.Handle(new CreateManualTranslation
        {
            UserId = _existingUser.Id,
            Word = expectedWord,
            Definition = expectedDefinition
        }, CancellationToken.None);

        result.ShouldBeOfType<ManualTranslationResult.EntrySaved>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
    }
    
    [Test]
    public async Task ShouldGetDefinitionFromVocabularyWhenWordAlreadyInVocabulary()
    {
        const string? expectedWord = "paucity";
        await _createVocabularyEntryCommandHandler.Handle(new CreateManualTranslation
        {
            UserId = _existingUser.Id,
            Word = expectedWord,
            Definition = expectedWord
        }, CancellationToken.None);
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new CreateManualTranslation
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.ShouldBeOfType<ManualTranslationResult.EntryAlreadyExists>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
    }
}