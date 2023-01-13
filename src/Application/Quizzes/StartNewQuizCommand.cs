using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Quizzes;

public class StartNewQuizCommand : IRequest<string>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<StartNewQuizCommand, string>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<string> Handle(StartNewQuizCommand request, CancellationToken ct)
        {
            if (request.UserId == null)
            {
                throw new ArgumentException("User Id cannot be null");
            }
            
            // todo: check here if any quizzes already started

            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                return "";
            }
            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted != false);
            if (startedQuizzesCount > 0)
            {
                return "";
            }
            
            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            
            var vocabularyEntries = user
                .VocabularyEntries
                .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                .ToList();

            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId.Value,
                QuizVocabularyEntries = vocabularyEntries
                    .Select(ve => new QuizVocabularyEntry {VocabularyEntry = ve}).ToList(),
                DateStarted = DateTime.UtcNow,
                IsCompleted = false
            };

            await _dbContext.Quizzes.AddAsync(quiz, ct);
            await _dbContext.SaveChangesAsync(ct);

            return vocabularyEntries.Count.ToString();
        }
    }
}