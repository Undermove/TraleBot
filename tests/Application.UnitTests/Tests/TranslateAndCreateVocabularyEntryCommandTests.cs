using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class TranslateAndCreateVocabularyEntryCommandTests : CommandTestsBase
{
    private Mock<IParsingTranslationService> _translationServicesMock = null!;
    private Mock<IParsingUniversalTranslator> _universalTranslationServicesMock = null!;
    private Mock<IAiTranslationService> _aiTranslationServicesMock = null!;
    private User _existingUser = null!;
    private TranslateAndCreateVocabularyEntry.Handler _createVocabularyEntryCommandHandler = null!;
    private Mock<IAchievementsService> _achievementsService = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _translationServicesMock = mockRepository.Create<IParsingTranslationService>();
        _universalTranslationServicesMock = mockRepository.Create<IParsingUniversalTranslator>();
        _aiTranslationServicesMock = mockRepository.Create<IAiTranslationService>();
        _achievementsService = mockRepository.Create<IAchievementsService>();
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<ManualTranslationTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<VocabularyCountTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _existingUser = Create.User().WithCurrentLanguage(Language.English).Build();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new TranslateAndCreateVocabularyEntry.Handler(_translationServicesMock.Object, _universalTranslationServicesMock.Object, Context, _achievementsService.Object, _aiTranslationServicesMock.Object);
    }
    
    [Test]
    public async Task ShouldSaveDefinitionFromTranslationServiceWhenRequestWithoutDefinitionIncome()
    {
        const string? expectedWord = "paucity";
        const string expectedDefinition = "недостаточность";
        const string expectedExample = @"
a paucity of useful answers to the problem of traffic congestion at rush hour 
нехватка полезных ответов на проблему пробок в час пик";
        _translationServicesMock
            .Setup(service => service.TranslateAsync(expectedWord, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.Value.ShouldBeOfType<TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.English);
    }
    
    [Test]
    public async Task ShouldTranslateGeorgianWordEvenIfCurrentLanguageIsEnglish()
    {
        const string? expectedWord = "თეფში";
        const string expectedDefinition = "тарелка";
        const string expectedExample = "ეს არის ის ფასი რასაც ვიხდით, რომ ვიყოთ ძალიან ჭკვიანები.";
        _universalTranslationServicesMock
            .Setup(service => service.TranslateAsync(expectedWord, Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.Value.ShouldBeOfType<TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.Georgian);
    }
    
    [Test]
    public async Task ShouldTranslateEnglishWordEvenIfCurrentLanguageIsGeorgian()
    {
        var userWithCurrentLanguageGeorgian = Create.User().WithCurrentLanguage(Language.Georgian).Build();
        Context.Users.Add(userWithCurrentLanguageGeorgian);
        await Context.SaveChangesAsync();
        const string? expectedWord = "plate";
        const string expectedDefinition = "тарелка";
        const string expectedExample = "Table was full of plates.";
        _translationServicesMock
            .Setup(service => service.TranslateAsync(expectedWord, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = userWithCurrentLanguageGeorgian.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.Value.ShouldBeOfType<TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.English);
    }
}