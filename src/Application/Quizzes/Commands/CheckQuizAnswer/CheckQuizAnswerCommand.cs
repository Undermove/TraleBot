using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CheckQuizAnswer;

public class CheckQuizAnswerCommand: IRequest<CheckQuizAnswerResult>
{
    public Guid? UserId { get; set; }
    public string Answer { get; set; }

    public class Handler : IRequestHandler<CheckQuizAnswerCommand, CheckQuizAnswerResult>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<CheckQuizAnswerResult> Handle(CheckQuizAnswerCommand request, CancellationToken ct)
        {
            var currentQuiz = await _dbContext.Quizzes
                .OrderBy(quiz => quiz.DateStarted)
                .LastAsync(quiz =>
                quiz.UserId == request.UserId &&
                quiz.IsCompleted == false, cancellationToken: ct);

            await _dbContext
                .Entry(currentQuiz)
                .Collection(nameof(currentQuiz.QuizQuestions))
                .LoadAsync(ct);
            
            if (currentQuiz.QuizQuestions.Count == 0)
            {
                throw new ApplicationException("Looks like quiz already completed or not started yet");
            }
            
            // todo: need to fix after service reloading NRE occurs here in entry.VocabularyEntry.DateAdded
            
            var quizQuestion = currentQuiz
                .QuizQuestions
                .OrderByDescending(entry => entry.VocabularyEntry.DateAdded)
                .Last();

            await _dbContext.Entry(quizQuestion).Reference(nameof(quizQuestion.VocabularyEntry)).LoadAsync(ct);

            CheckQuizAnswerResult result;
            if (quizQuestion.Answer.Equals(request.Answer, StringComparison.InvariantCultureIgnoreCase))
            {
                currentQuiz.CorrectAnswersCount++;
                quizQuestion.VocabularyEntry.SuccessAnswersCount++;
                result = new CheckQuizAnswerResult(true, quizQuestion.Answer,
                    quizQuestion.VocabularyEntry.GetScoreToNextLevel());
            }
            else
            {
                currentQuiz.IncorrectAnswersCount++;
                quizQuestion.VocabularyEntry.FailedAnswersCount++;
                result = new CheckQuizAnswerResult(false, quizQuestion.Answer,
                    quizQuestion.VocabularyEntry.GetScoreToNextLevel());
            }

            currentQuiz.QuizQuestions.Remove(quizQuestion);
            await _dbContext.SaveChangesAsync(ct);
            return result;
        }
    }
}