using System.Security.Cryptography.X509Certificates;
using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using MediatR;

namespace Application.Quizzes.Commands.StartNewQuiz;

public class StartNewQuizCommand : IRequest<StartNewQuizResult>
{
    public Guid? UserId { get; set; }
    public QuizTypes QuizType { get; set; }
    
    public class Handler: IRequestHandler<StartNewQuizCommand, StartNewQuizResult>
    {
        private readonly ITraleDbContext _dbContext;
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<StartNewQuizResult> Handle(StartNewQuizCommand request, CancellationToken ct)
        {
            if (request.UserId == null)
            {
                throw new ArgumentException("User Id cannot be null");
            }

            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new NotFoundException(nameof(User), request.UserId);
            }

            if (user.AccountType == UserAccountType.Free && request.QuizType != QuizTypes.LastWeek)
            {
                return new StartNewQuizResult(0, false);
            }

            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted == false);
            if (startedQuizzesCount > 0)
            {
                return new StartNewQuizResult(0, false);
            }
            
            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            
            var vocabularyEntries = CreateQuizQuestions(user, request.QuizType);

            if (vocabularyEntries.Count == 0)
            {
                return new StartNewQuizResult(0, false);
            }

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

            return new StartNewQuizResult(vocabularyEntries.Count, true);
        }

        private static List<VocabularyEntry> CreateQuizQuestions(User user, QuizTypes quizType)
        {
            Random rnd = new Random();
            var vocabularyEntries = new List<VocabularyEntry>();
            
            switch (quizType)
            {
                case QuizTypes.LastWeek:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                        .ToList();
                    break;
                case QuizTypes.LastDay:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-1))
                        .ToList();
                    break;
                case QuizTypes.SeveralRandomWords:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .OrderBy(_ => rnd.Next()).Take(10)
                        .ToList();
                    break;
                case QuizTypes.MostFailed:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-30))
                        .Where(entry => entry.SuccessAnswersCount <= entry.FailedAnswersCount || 
                                        entry.SuccessAnswersCount <= 3)
                        .ToList();
                    break;
            }
            
            return vocabularyEntries;
        }
    }
}