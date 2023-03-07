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
    private User _existingUser;
    private CreateVocabularyEntryCommand.Handler _createVocabularyEntryCommandHandler;
        
    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _translationServicesMock = mockRepository.Create<ITranslationService>();
        
        _existingUser = Create.TestUser();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new CreateVocabularyEntryCommand.Handler(_translationServicesMock.Object, Context);
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
        const string expectedWord = "paucity";
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
}