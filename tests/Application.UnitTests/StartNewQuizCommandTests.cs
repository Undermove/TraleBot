using Application.Quizzes.Commands.StartNewQuiz;
using Application.UnitTests.Common;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests;

public class StartNewQuizCommandTests : CommandTestsBase
{
    [Test]
    public async Task ShouldReturnNeedPremiumToActivate_ForUserWithoutPremium()
    {
        var existingUser = Create.User().Build();
        Context.Users.Add(existingUser);
        
        var sut = new StartNewQuizCommand.Handler(Context);

        var result = await sut.Handle(new StartNewQuizCommand
        {
            UserId = existingUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT2.ShouldBe(true);
        result.AsT2.ShouldBeOfType<NeedPremiumToActivate>();
        result.AsT2.ShouldNotBeNull();
    }

    [Test]
    public async Task ShouldReturnNotEnoughWords_ForPremiumUser_WithoutVocabularyEntries()
    {
        var existingUser = Create.User().WithPremiumAccountType().Build();
        Context.Users.Add(existingUser);
        var sut = new StartNewQuizCommand.Handler(Context);
        
        var result = await sut.Handle(new StartNewQuizCommand
        {
            UserId = existingUser.Id, 
            QuizType = QuizTypes.ForwardDirection
        }, CancellationToken.None);
        
        result.IsT1.ShouldBe(true);
        result.AsT1.ShouldBeOfType<NotEnoughWords>();
        result.AsT1.ShouldNotBeNull();
    }
}