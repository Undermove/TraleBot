using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
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
    private User _existingUser = null!;
    private TranslateAndCreateVocabularyEntry.Handler _createVocabularyEntryCommandHandler = null!;
    private Mock<IAchievementsService> _achievementsService = null!;
    private Mock<ILanguageTranslator> _languageTranslatorMock = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _languageTranslatorMock = mockRepository.Create<ILanguageTranslator>();
        _achievementsService = mockRepository.Create<IAchievementsService>();
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<ManualTranslationTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _achievementsService.Setup(service => service.AssignAchievements(
                It.IsAny<VocabularyCountTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _existingUser = Create.User().WithPremiumAccountType().WithCurrentLanguage(Language.English).Build();
        Context.Users.Add(_existingUser);
        await Context.SaveChangesAsync();
        
        _createVocabularyEntryCommandHandler = new TranslateAndCreateVocabularyEntry.Handler(
            _languageTranslatorMock.Object,
            Context,
            _achievementsService.Object);
    }
    
    [Test]
    public async Task ShouldSaveDefinitionFromTranslationServiceWhenRequestWithoutDefinitionIncome()
    {
        const string? expectedWord = "paucity";
        const string expectedDefinition = "недостаточность";
        const string expectedExample = @"
a paucity of useful answers to the problem of traffic congestion at rush hour 
нехватка полезных ответов на проблему пробок в час пик";
        _languageTranslatorMock
            .Setup(service => service.Translate(expectedWord, Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.TranslationSuccess>();
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
        _languageTranslatorMock
            .Setup(service => service.Translate(expectedWord, Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = _existingUser.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.Georgian);
    }
    
    [Test]
    public async Task ShouldReturnSubscriptionRequired_WhenUserHasNoActiveProOrTrial()
    {
        // Lapsed Pro: registered ages ago, paid once, sub expired.
        var lapsedUser = Create.User().WithCurrentLanguage(Language.English).Build();
        lapsedUser.RegisteredAtUtc = DateTime.UtcNow.AddDays(-90);
        lapsedUser.IsPro = true;
        lapsedUser.SubscriptionPlan = SubscriptionPlan.Month;
        lapsedUser.SubscribedUntil = DateTime.UtcNow.AddDays(-3);
        Context.Users.Add(lapsedUser);
        await Context.SaveChangesAsync();

        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = lapsedUser.Id,
            Word = "paucity"
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.SubscriptionRequired>();
        Context.VocabularyEntries.Count(v => v.UserId == lapsedUser.Id).ShouldBe(0);
        _languageTranslatorMock.Verify(
            s => s.Translate(It.IsAny<string>(), It.IsAny<Language>(), It.IsAny<CancellationToken>()),
            Times.Never,
            "translator must not be called when the user is not entitled");
    }

    [Test]
    public async Task ShouldTranslate_WhenUserIsOnActiveTrial()
    {
        // Newly registered user (no payment) — has 30-day free trial, must be able to translate.
        var trialUser = Create.User().WithCurrentLanguage(Language.English).Build();
        trialUser.RegisteredAtUtc = DateTime.UtcNow;
        trialUser.IsPro = false;
        trialUser.TrialBonusDays = 0;
        Context.Users.Add(trialUser);
        await Context.SaveChangesAsync();
        _languageTranslatorMock
            .Setup(s => s.Translate("paucity", Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("недостаточность", "недостаточность", "ex"));

        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = trialUser.Id,
            Word = "paucity"
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.TranslationSuccess>();
    }

    [Test]
    public async Task ShouldReturnSubscriptionRequired_WhenTrialAlsoExpired()
    {
        var staleUser = Create.User().WithCurrentLanguage(Language.English).Build();
        staleUser.RegisteredAtUtc = DateTime.UtcNow.AddDays(-31);
        staleUser.IsPro = false;
        Context.Users.Add(staleUser);
        await Context.SaveChangesAsync();

        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = staleUser.Id,
            Word = "paucity"
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.SubscriptionRequired>();
    }

    [Test]
    public async Task ShouldTranslateEnglishWordEvenIfCurrentLanguageIsGeorgian()
    {
        var userWithCurrentLanguageGeorgian = Create.User().WithPremiumAccountType().WithCurrentLanguage(Language.Georgian).Build();
        Context.Users.Add(userWithCurrentLanguageGeorgian);
        await Context.SaveChangesAsync();
        const string? expectedWord = "plate";
        const string expectedDefinition = "тарелка";
        const string expectedExample = "Table was full of plates.";
        _languageTranslatorMock
            .Setup(service => service.Translate(expectedWord, Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success(expectedDefinition, expectedDefinition, expectedExample));
        
        var result = await _createVocabularyEntryCommandHandler.Handle(new TranslateAndCreateVocabularyEntry
        {
            UserId = userWithCurrentLanguageGeorgian.Id,
            Word = expectedWord
        }, CancellationToken.None);

        result.ShouldBeOfType<CreateVocabularyEntryResult.TranslationSuccess>();
        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
        vocabularyEntry.Example.ShouldBe(expectedExample);
        vocabularyEntry.Language.ShouldBe(Language.English);
    }
}