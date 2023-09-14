using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using Domain.Quiz;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CreateSharedQuiz;

public class CreateQuizFromShareableCommand : IRequest<SharedQuizCreatedResult>
{
    public required Guid UserId { get; set; }
    public required Guid ShareableQuizId { get; set; }

    public class Handler : IRequestHandler<CreateQuizFromShareableCommand, SharedQuizCreatedResult>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IQuizCreator _quizCreator;

        public Handler(ITraleDbContext dbContext, IQuizCreator quizCreator)
        {
            _dbContext = dbContext;
            _quizCreator = quizCreator;
        }

        public async Task<SharedQuizCreatedResult> Handle(CreateQuizFromShareableCommand request, CancellationToken ct)
        {
            var shareableQuiz = await _dbContext.ShareableQuizzes.FirstOrDefaultAsync(
                quiz => quiz.Id == request.ShareableQuizId,
                cancellationToken: ct);
            
            if(shareableQuiz == null)
                throw new NotFoundException(nameof(ShareableQuiz), request.ShareableQuizId);
            
            var vocabularyEntries = await _dbContext.VocabularyEntries
                .Where(ve => shareableQuiz.VocabularyEntriesIds.Contains(ve.Id))
                .ToArrayAsync(ct);

            var quizQuestions = _quizCreator.CreateQuizQuestions(vocabularyEntries, shareableQuiz.QuizType);
            
            if (quizQuestions.Count == 0)
            {
                return new SharedQuizCreatedResult();
            }
            
            await SaveQuiz(request.UserId, ct, quizQuestions);
            
            await _dbContext.SaveChangesAsync(ct);
            
            return new SharedQuizCreatedResult();
        }
        
        private async Task SaveQuiz(
            Guid userId,
            CancellationToken ct,
            List<QuizQuestion> quizQuestions)
        {
            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                QuizQuestions = quizQuestions,
                DateStarted = DateTime.UtcNow,
                IsCompleted = false
            };
            
            await _dbContext.Quizzes.AddAsync(quiz, ct);
        }
    }
}