using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.VocabularyEntries.Commands;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class TranslateToAnotherLanguageAndChangeCurrentLanguageCommandTests : CommandTestsBase
{
    private Mock<ILanguageTranslator> _aiTranslationServicesMock = null!;
    private User _existingUser = null!;
    private VocabularyEntry _existingVocabularyEntry = null!;
    private TranslateToAnotherLanguageAndChangeCurrentLanguage.Handler _createVocabularyEntryCommandHandler = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _aiTranslationServicesMock = mockRepository.Create<ILanguageTranslator>();

        _existingUser = Create.User().WithPremiumAccountType().WithCurrentLanguage(Language.English).Build();
        _existingVocabularyEntry = Create.VocabularyEntry()
            .WithUser(_existingUser)
            .WithWord("недостаточность")
            .WithDefinition("paucity")
            .WithExample("a paucity of useful answers to the problem of traffic congestion at rush hour")
            .WithLanguage(Language.English)
            .Build();
        Context.Users.Add(_existingUser);
        Context.VocabularyEntries.Add(_existingVocabularyEntry);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new TranslateToAnotherLanguageAndChangeCurrentLanguage.Handler(
            Context, 
            _aiTranslationServicesMock.Object);
    }
    
    [Test]
    public async Task ShouldSaveDefinitionFromTranslationServiceWhenRequestWithoutDefinitionIncome()
    {
        const string? expectedWord = "недостаточность";
        const string expectedDefinition = "ნაკლებობა";
        const string expectedExample = "რეალურად, 20 წლის წინ ჩვენ ვცხოვრობდით მსოფლიოში, სადაც პრობლემა";
        _aiTranslationServicesMock
            .Setup(service => service.Translate(expectedWord, Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = _existingUser,
            TargetLanguage = Language.Georgian,
            VocabularyEntryId = _existingVocabularyEntry.Id
        }, CancellationToken.None);

        result.ShouldBeOfType<ChangeAndTranslationResult.TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .SingleOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.Georgian);
        _existingUser.Settings.CurrentLanguage.ShouldBe(Language.Georgian);
    }
    
    [Test]
    public async Task ShouldReturnNeedPremiumWhenRequestFromFreeUser()
    {
        var freeUser = Create.User().WithCurrentLanguage(Language.English).Build();
        Context.Users.Add(freeUser);
        
        const string? expectedWord = "недостаточность";
        const string expectedDefinition = "ნაკლებობა";
        const string expectedExample = "რეალურად, 20 წლის წინ ჩვენ ვცხოვრობდით მსოფლიოში, სადაც პრობლემა";
        _aiTranslationServicesMock
            .Setup(service => service.Translate(expectedWord, Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateToAnotherLanguageAndChangeCurrentLanguage
        {
            User = freeUser,
            TargetLanguage = Language.Georgian,
            VocabularyEntryId = _existingVocabularyEntry.Id
        }, CancellationToken.None);

        result.ShouldBeOfType<ChangeAndTranslationResult.PremiumRequired>();
        freeUser.Settings.CurrentLanguage.ShouldBe(Language.English);
    }
}