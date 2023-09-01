using Application.Quizzes.Commands.CreateSharedQuiz;
using Application.UnitTests.Common;
using Domain.Entities;

namespace Application.UnitTests;

public class CreateSharedQuizCommandTests : CommandTestsBase
{
    private CreateSharedQuizCommand.Handler _createSharedQuizCommandHandler = null!;

    [Test]
    public async Task HandlerShouldCreateSharedQuiz()
    {
        // arrange
        // _createSharedQuizCommandHandler = new CreateSharedQuizCommand.Handler(Context);
        //
        // // act
        // var result = await _createSharedQuizCommandHandler.Handle(new CreateSharedQuizCommand
        // {
        //     VocabularyEntryIds = vocabularyEntries,
        //     QuizType = QuizTypes.LastWeek
        // }, CancellationToken.None);
        //
        // // assert
        // result.ShouldContain(entry => entry.Word == "cat");    
    }
}