using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Quizzes.Services;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Domain.Quiz;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace Application.UnitTests.Tests;

public class CreateQuizFromShareableCommandTests : CommandTestsBase
{
    private CreateQuizFromShareableCommand.Handler _sut = null!;
    
    [SetUp]
    public void SetUp()
    {
        _sut = new CreateQuizFromShareableCommand.Handler(Context, new QuizCreator());
    }
    
    [Test]
    public async Task ShouldCreateQuizWithVocabularyEntries()
    {
        var (user, vocabularyEntry, shareableQuiz) = await CreatePremiumUserWithShareableQuiz();
        
        var result = await _sut.Handle(new CreateQuizFromShareableCommand
        {
            UserId = user.Id, 
            ShareableQuizId = shareableQuiz.Id
        }, CancellationToken.None);
        
        result.IsT0.ShouldBeTrue();
        Context.Quizzes.Count().ShouldBe(1);
        var quiz = Context.Quizzes.Include(quiz => quiz.QuizQuestions).FirstOrDefault();
        quiz.ShouldNotBeNull();
        quiz.QuizQuestions.ShouldContain(question => question.VocabularyEntryId == vocabularyEntry.Id);
    }
    
    [Test]
    public async Task ShouldNotCreateQuizWhenAnotherQuizInProgress()
    {
        var (user, vocabularyEntry, shareableQuiz) = await CreatePremiumUserWithShareableQuiz();
        await _sut.Handle(new CreateQuizFromShareableCommand
        {
            UserId = user.Id, 
            ShareableQuizId = shareableQuiz.Id
        }, CancellationToken.None);
        
        var result = await _sut.Handle(new CreateQuizFromShareableCommand
        {
            UserId = user.Id, 
            ShareableQuizId = shareableQuiz.Id
        }, CancellationToken.None);
        
        result.IsT2.ShouldBeTrue();
        Context.Quizzes.Count().ShouldBe(1);
        var quiz = Context.Quizzes.Include(quiz => quiz.QuizQuestions).FirstOrDefault();
        quiz.ShouldNotBeNull();
        quiz.QuizQuestions.ShouldContain(question => question.VocabularyEntryId == vocabularyEntry.Id);
    }
    
    private async Task<(User, VocabularyEntry, ShareableQuiz)> CreatePremiumUserWithShareableQuiz()
    {
        var premiumUser = CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().WithUser(premiumUser).Build();
        Context.VocabularyEntries.Add(vocabularyEntry);

        var shareableQuiz = new ShareableQuiz
        {
            Id = Guid.NewGuid(),
            QuizType = QuizTypes.LastWeek,
            DateAddedUtc = DateTime.UtcNow,
            CreatedByUserId = premiumUser.Id,
            CreatedByUser = premiumUser,
            VocabularyEntriesIds = new List<Guid> {vocabularyEntry.Id} 
        };
        
        Context.ShareableQuizzes.Add(shareableQuiz);
        await Context.SaveChangesAsync();
        
        return (premiumUser, vocabularyEntry, shareableQuiz);
    }
}