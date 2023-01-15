using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands;

public class CompleteQuizCommand : IRequest
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<CompleteQuizCommand>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public Task<Unit> Handle(CompleteQuizCommand request, CancellationToken ct)
        {
            return Task.FromResult(Unit.Value);
        }
    }
}