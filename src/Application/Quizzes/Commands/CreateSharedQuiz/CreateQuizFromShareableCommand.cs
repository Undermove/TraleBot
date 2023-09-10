using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CreateSharedQuiz;

public class CreateQuizFromShareableCommand : IRequest<SharedQuizCreatedResult>
{
    public required Guid ShareableQuizId { get; set; }

    public class Handler : IRequestHandler<CreateQuizFromShareableCommand, SharedQuizCreatedResult>
    {
        private readonly ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public async Task<SharedQuizCreatedResult> Handle(CreateQuizFromShareableCommand request, CancellationToken cancellationToken)
        {
            var shareableQuiz = await _context.ShareableQuizzes.FirstOrDefaultAsync(
                quiz => quiz.Id == request.ShareableQuizId,
                cancellationToken: cancellationToken);
            
            var quizQuestions  = _context.VocabularyEntries.FindAsync(
                new[] { shareableQuiz!.VocabularyEntriesIds.ToArray() },
                cancellationToken: cancellationToken);
            
            return new SharedQuizCreatedResult();
        }
    }

}