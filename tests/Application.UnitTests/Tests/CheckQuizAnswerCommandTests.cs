using Application.Quizzes.Commands.CheckQuizAnswer;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class CheckQuizAnswerCommandTests : CommandTestsBase
{
    private CheckQuizAnswerCommand.Handler _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new CheckQuizAnswerCommand.Handler(Context);
    }

    [Test]
    public async Task ShouldReturnSuccessAndRemoveQuizQuestion_WhenAnswerIsCorrect()
    {
        var user = await CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().Build();
        var quiz = await CreateQuizWithOneQuestion(user, vocabularyEntry);
        CheckQuizAnswerCommand command = new CheckQuizAnswerCommand
        {
            UserId = user.Id,
            Answer = vocabularyEntry.Definition
        };

        var oneOf = await _sut.Handle(command, CancellationToken.None);

        var result = oneOf.AsT0;
        result.ShouldNotBeNull();
        Context.QuizQuestions.Count().ShouldBe(0);
        vocabularyEntry.SuccessAnswersCount.ShouldBe(1);
        quiz.CorrectAnswersCount.ShouldBe(1);
        quiz.IncorrectAnswersCount.ShouldBe(0);
    }

    [Test]
    public async Task ShouldReturnFailAndRemoveQuizQuestion_WhenAnswerIsInCorrect()
    {
        var user = await CreatePremiumUser();
        var vocabularyEntry = Create.VocabularyEntry().Build();
        var quiz = await CreateQuizWithOneQuestion(user, vocabularyEntry);
        CheckQuizAnswerCommand command = new CheckQuizAnswerCommand
        {
            UserId = user.Id,
            Answer = "Incorrect Answer"
        };

        var oneOf = await _sut.Handle(command, CancellationToken.None);


        IncorrectAnswer? result = oneOf.AsT1;
        result.ShouldNotBeNull();
        Context.QuizQuestions.Count().ShouldBe(0);
        vocabularyEntry.SuccessAnswersCount.ShouldBe(0);
        quiz.CorrectAnswersCount.ShouldBe(0);
        quiz.IncorrectAnswersCount.ShouldBe(1);
    }

    [Test]
    public async Task ShouldReturnQuizCompleted_WhenThereIsNoQuestions()
    {
        var user = await CreatePremiumUser();
        var quiz = Create.Quiz().CreatedByUser(user).Build();
        Context.Quizzes.Add(quiz);
        await Context.SaveChangesAsync(CancellationToken.None);
        
        CheckQuizAnswerCommand command = new CheckQuizAnswerCommand
        {
            UserId = user.Id,
            Answer = "any word"
        };

        var oneOf = await _sut.Handle(command, CancellationToken.None);

        QuizCompleted? result = oneOf.AsT2;
        result.ShouldNotBeNull();
        Context.QuizQuestions.Count().ShouldBe(0);
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