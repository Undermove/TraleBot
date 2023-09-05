using Application.Quizzes.Commands.StartNewQuiz;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class StartNewQuizCommandTests : CommandTestsBase
{
    private StartNewQuizCommand.Handler _sut = null!;
    
    [SetUp]
    public void SetUp()
    {
        _sut = new StartNewQuizCommand.Handler(Context);
    }
    
    [Test]
    public async Task ShouldReturnNeedPremiumToActivate_ForUserWithoutPremium()
    {
        var existingUser = Create.User().Build();
        Context.Users.Add(existingUser);
        
        var result = await _sut.Handle(new StartNewQuizCommand
        {
            UserId = existingUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT2.ShouldBeTrue();
        result.AsT2.ShouldBeOfType<NeedPremiumToActivate>();
        result.AsT2.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldReturnNotEnoughWords_ForPremiumUser_WithoutVocabularyEntries()
    {
        var premiumUser = CreatePremiumUser();
        
        var result = await _sut.Handle(new StartNewQuizCommand
        {
            UserId = premiumUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT1.ShouldBeTrue();
        result.AsT1.ShouldBeOfType<NotEnoughWords>();
        result.AsT1.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldReturnForwardDirectionWords_ForPremiumUser_WithVocabularyEntries()
    {
        var (premiumUser, _) = CreatePremiumUserWithVocabularyEntry();
        
        var result = await _sut.Handle(new StartNewQuizCommand
        {
            UserId = premiumUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT0.ShouldBeTrue();
        result.AsT0.ShouldBeOfType<QuizStarted>();
        result.AsT0.QuizQuestionsCount.ShouldBe(1);
    }
    
    [Test]
    public async Task ShouldReturnQuizAlreadyStarted_WhenAnotherQuizInProgress()
    {
        var (premiumUser, _) = CreatePremiumUserWithVocabularyEntry();
        await StartFirstQuiz(premiumUser);
        
        var result = await _sut.Handle(new StartNewQuizCommand
        {
            UserId = premiumUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT3.ShouldBeTrue();
        result.AsT3.ShouldBeOfType<QuizAlreadyStarted>();
    }
    
    [Test]
    public async Task ShouldCreateShareableQuiz_WhenQuizStarted()
    {
        var (premiumUser, vocabularyEntry) = CreatePremiumUserWithVocabularyEntry();
        
        await _sut.Handle(new StartNewQuizCommand
        {
            UserId = premiumUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        Context.ShareableQuizzes.Count().ShouldBe(1);
        Context.ShareableQuizzes.ShouldContain(quiz => quiz.VocabularyEntriesIds.Any(entry => entry == vocabularyEntry.Id));
    }

    private (User, VocabularyEntry) CreatePremiumUserWithVocabularyEntry()
    {
        var premiumUser = CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().WithUser(premiumUser).Build();
        Context.VocabularyEntries.Add(vocabularyEntry);
        return (premiumUser, vocabularyEntry);
    }

    private async Task StartFirstQuiz(User premiumUser)
    {
        await _sut.Handle(new StartNewQuizCommand
        {
            UserId = premiumUser.Id,
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
    }

    private User CreatePremiumUser()
    {
        var premiumUser = Create.User().WithPremiumAccountType().Build();
        Context.Users.Add(premiumUser);
        return premiumUser;
    }
}