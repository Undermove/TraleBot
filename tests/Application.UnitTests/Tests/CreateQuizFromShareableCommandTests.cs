using Application.Quizzes.Commands.CreateSharedQuiz;
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
        _sut = new CreateQuizFromShareableCommand.Handler(Context);
    }
    
    // [Test]
    public async Task Test1()
    {
        var (vocabularyEntry, shareableQuiz) = CreatePremiumUserWithShareableQuiz();
        
        await _sut.Handle(new CreateQuizFromShareableCommand
        {
            ShareableQuizId = shareableQuiz.Id
        }, CancellationToken.None);
        
        Context.Quizzes.Count().ShouldBe(1);
        var quiz = Context.Quizzes.Include(quiz => quiz.QuizQuestions).FirstOrDefault();
        quiz.ShouldNotBeNull();
        quiz.QuizQuestions.ShouldContain(question => question.VocabularyEntryId == vocabularyEntry.Id);
    }
    
    private (VocabularyEntry, ShareableQuiz) CreatePremiumUserWithShareableQuiz()
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
            VocabularyEntriesIds = new List<Guid>(){vocabularyEntry.Id} 
        };
        
        Context.ShareableQuizzes.Add(shareableQuiz);
        
        return (vocabularyEntry, shareableQuiz);
    }
}