using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using Domain.Quiz;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CreateSharedQuiz;

public class CreateQuizFromShareableCommand : IRequest<CreateQuizFromShareableResult>
{
    public required Guid UserId { get; set; }
    public required Guid ShareableQuizId { get; set; }

    public class Handler(ITraleDbContext dbContext, IQuizCreator quizCreator) 
        : IRequestHandler<CreateQuizFromShareableCommand, CreateQuizFromShareableResult>
    {
        public async Task<CreateQuizFromShareableResult> Handle(CreateQuizFromShareableCommand request, CancellationToken ct)
        {
            var startedQuiz = await dbContext.Quizzes
                .FirstOrDefaultAsync(quiz => quiz.UserId == request.UserId && quiz.IsCompleted == false, ct);
            if (startedQuiz != null)
            {
                dbContext.QuizQuestions.RemoveRange(startedQuiz.QuizQuestions);
                startedQuiz.IsCompleted = true;
                startedQuiz.QuizQuestions.Clear();
                
                dbContext.Quizzes.Update(startedQuiz);
                await dbContext.SaveChangesAsync(ct);
            }
            
            var shareableQuiz = await dbContext.ShareableQuizzes.FirstOrDefaultAsync(
                quiz => quiz.Id == request.ShareableQuizId,
                cancellationToken: ct);
            
            if(shareableQuiz == null)
                throw new NotFoundException(nameof(ShareableQuiz), request.ShareableQuizId);
            
            var vocabularyEntries = await dbContext.VocabularyEntries
                .Where(ve => shareableQuiz.VocabularyEntriesIds.Contains(ve.Id))
                .ToArrayAsync(ct);
            
            var quizQuestions = quizCreator.CreateQuizQuestions(vocabularyEntries, vocabularyEntries).ToArray();
            
            if (quizQuestions.Length == 0)
            {
                return new CreateQuizFromShareableResult.NotEnoughQuestionsForSharedQuiz();
            }
            
            await SaveQuiz(request.UserId, ct, quizQuestions, shareableQuiz);
            
            await dbContext.SaveChangesAsync(ct);
            
            var firstQuestion = quizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();
            
            return new CreateQuizFromShareableResult.SharedQuizCreated(quizQuestions.Length, firstQuestion);
        }
        
        private async Task SaveQuiz(Guid userId,
            CancellationToken ct,
            QuizQuestion[] quizQuestions, 
            ShareableQuiz shareableQuiz)
        {
            var createdByUserScore = shareableQuiz.Quiz.GetCorrectnessPercent();
            
            var quiz = new SharedQuiz
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                QuizQuestions = quizQuestions.ToList(),
                DateStarted = DateTime.UtcNow,
                IsCompleted = false,
                CreatedByUserName = shareableQuiz.CreatedByUserName,
                CreatedByUserScore = createdByUserScore,
            };

            await dbContext.Quizzes.AddAsync(quiz, ct);
        }
    }
}

public abstract record CreateQuizFromShareableResult
{
    public sealed record SharedQuizCreated(int QuestionsCount, QuizQuestion FirstQuestion)
        : CreateQuizFromShareableResult;

    public sealed record NotEnoughQuestionsForSharedQuiz : CreateQuizFromShareableResult;
}