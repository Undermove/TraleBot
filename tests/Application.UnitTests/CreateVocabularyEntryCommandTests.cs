using Application.Achievements;
using Application.Common.Interfaces;
using Application.Common.Interfaces.TranslationService;
using Application.UnitTests.Common;
using Application.VocabularyEntries.Commands;
using Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests;

public class CreateVocabularyEntryCommandTests : CommandTestsBase
{
    private Mock<ITranslationService> _translationServicesMock = null!;
    private User _existingUser = null!;
    private CreateVocabularyEntryCommand.Handler _createVocabularyEntryCommandHandler = null!;
    private Mock<IAchievementUnlocker> _achievementsService = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _translationServicesMock = mockRepository.Create<ITranslationService>();
        _achievementsService = mockRepository.Create<IAchievementUnlocker>();

        _existingUser = Create.TestUser();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new CreateVocabularyEntryCommand.Handler(_translationServicesMock.Object, Context, _achievementsService.Object);
    }

    [Test]
    public async Task ShouldSaveManualDefinitionWhenItComes()
    {
        const string expectedWord = "cat";
        const string expectedDefinition = "кошка";
        await _createVocabularyEntryCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = _existingUser.Id,
            Word = expectedWord,
            Definition = expectedDefinition
        }, CancellationToken.None);

        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
    }
    
    [Test]
    public async Task ShouldSaveDefinitionFromTranslationServiceWhenRequestWithoutDefinitionIncome()
    {
        const string? expectedWord = "paucity";
        const string expectedDefinition = "недостаточность";
        _translationServicesMock
            .Setup(service => service.TranslateAsync(expectedWord, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult(expectedDefinition, expectedDefinition, true));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.TranslationStatus.ShouldBe(TranslationStatus.Translated);
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
    }
    
    [Test]
    public async Task ShouldNotSaveDefinitionFromTranslationServiceWhenCantTranslateWordException()
    {
        const string? expectedWord = "paucity";
        _translationServicesMock
            .Setup(service => service.TranslateAsync(expectedWord, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult("", "", false));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.TranslationStatus.ShouldBe(TranslationStatus.CantBeTranslated);
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldBeNull();
    }
    
    [Test]
    public async Task ShouldGetDefinitionFromVocabularyWhenWordAlreadyInVocabulary()
    {
        const string? expectedWord = "paucity";
        await _createVocabularyEntryCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = _existingUser.Id,
            Word = expectedWord,
            Definition = expectedWord
        }, CancellationToken.None);
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.TranslationStatus.ShouldBe(TranslationStatus.ReceivedFromVocabulary);
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
    }
}