using Application.Quizzes.Commands.CheckQuizAnswer;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class CheckQuizAnswerCommandTests : CommandTestsBase
{
    private readonly CheckQuizAnswerCommand.Handler _sut;

    public CheckQuizAnswerCommandTests()
    {
        _sut = new CheckQuizAnswerCommand.Handler(Context);
    }
    
    [Test]
    public async Task Test()
    {
        var user = await CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().Build();
        var quiz = await CreateQuizWithOneQuestion(user, vocabularyEntry);
        CheckQuizAnswerCommand command = new CheckQuizAnswerCommand
        {
            UserId = user.Id,
            Answer = vocabularyEntry.Definition
        };
        
        var result = await _sut.Handle(command, CancellationToken.None);
        
        result.IsAnswerCorrect.ShouldBeTrue();
    }

    private async Task<Quiz> CreateQuizWithOneQuestion(User user, VocabularyEntry vocabularyEntry)
    {
        // maybe i can create some kind of source generator for builders? Sounds useful.
        var quiz = Create
            .Quiz()
            .CreatedByUser(user)
            .AddQuizQuestionWithVocabularyEntry(vocabularyEntry)
            .Build();
        Context.Quizzes.Add(quiz);
        await Context.SaveChangesAsync(CancellationToken.None);
        return quiz;
    }
}