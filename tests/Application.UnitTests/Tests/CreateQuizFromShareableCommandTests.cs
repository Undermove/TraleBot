using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.Quizzes.Services;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
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
        
        result.ShouldBeOfType<SharedQuizCreated>();
        Context.Quizzes.Count().ShouldBe(2);
        var quiz = Context.Quizzes
            .Where(q => q.GetType() == typeof(SharedQuiz))
            .Include(quiz => quiz.QuizQuestions)
            .FirstOrDefault();
        quiz.ShouldNotBeNull();
        quiz.QuizQuestions.ShouldContain(question => question.VocabularyEntryId == vocabularyEntry.Id);
    }
    
    [Test]
    public async Task ShouldRecreateQuizWhenAnotherQuizInProgress()
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
        
        result.ShouldBeOfType<SharedQuizCreated>();
        Context.Quizzes.Count(q => q.GetType() == typeof(SharedQuiz)).ShouldBe(2);
        Context.Quizzes.Count(q => q.GetType() == typeof(UserQuiz)).ShouldBe(1);
        Context.Quizzes.Count(q => q.GetType() == typeof(SharedQuiz) && q.IsCompleted == false).ShouldBe(1);
        Context.Quizzes.Count(q => q.GetType() == typeof(SharedQuiz) && q.IsCompleted == true).ShouldBe(1);
        
        var completedQuiz = Context.Quizzes.Where(q => q.GetType() == typeof(SharedQuiz) && q.IsCompleted == true)
            .Include(quiz => quiz.QuizQuestions)
            .FirstOrDefault();
        
        completedQuiz.ShouldNotBeNull();
        completedQuiz.QuizQuestions.Count.ShouldBe(0);
        
        var startedQuiz = Context.Quizzes.Where(q => q.GetType() == typeof(SharedQuiz) && q.IsCompleted == false)
            .Include(quiz => quiz.QuizQuestions)
            .FirstOrDefault();
        startedQuiz.ShouldNotBeNull();
        startedQuiz.QuizQuestions.Count.ShouldBe(4);
        startedQuiz.QuizQuestions.ShouldContain(question => question.VocabularyEntryId == vocabularyEntry.Id);
    }
    
    private async Task<(User, VocabularyEntry, ShareableQuiz)> CreatePremiumUserWithShareableQuiz()
    {
        var premiumUser = await CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().WithUser(premiumUser).Build();
        Context.VocabularyEntries.Add(vocabularyEntry);
        var quiz = Create.Quiz().WithCompleted().CreatedByUser(premiumUser).Build();

        var shareableQuiz = new ShareableQuiz
        {
            Id = Guid.NewGuid(),
            QuizType = QuizTypes.LastWeek,
            DateAddedUtc = DateTime.UtcNow,
            CreatedByUserId = premiumUser.Id,
            CreatedByUser = premiumUser,
            CreatedByUserName = "NameFromRequest",
            VocabularyEntriesIds = new List<Guid> {vocabularyEntry.Id},
            Quiz = quiz 
        };
        
        Context.ShareableQuizzes.Add(shareableQuiz);
        await Context.SaveChangesAsync();
        
        return (premiumUser, vocabularyEntry, shareableQuiz);
    }
}