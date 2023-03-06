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
            
            var quizQuestions = CreateQuizQuestions(user, request.QuizType);

            if (quizQuestions.Count == 0)
            {
                return new StartNewQuizResult(0, false);
            }

            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId.Value,
                QuizQuestions = quizQuestions,
                DateStarted = DateTime.UtcNow,
                IsCompleted = false
            };

            await _dbContext.Quizzes.AddAsync(quiz, ct);
            await _dbContext.SaveChangesAsync(ct);

            return new StartNewQuizResult(quizQuestions.Count, true);
        }

        private static List<QuizQuestion> CreateQuizQuestions(User user, QuizTypes quizType)
        {
            Random rnd = new Random();
            var vocabularyEntries = new List<QuizQuestion>();
            
            switch (quizType)
            {
                case QuizTypes.LastWeek:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                        .Select(QuizQuestion)
                        .ToList();
                    break;
                case QuizTypes.SeveralComplicatedWords:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.SuccessAnswersCount < entry.FailedAnswersCount)
                        .OrderBy(_ => rnd.Next()).Take(10)
                        .Select(QuizQuestion)
                        .ToList();
                    break;
                case QuizTypes.ForwardDirection:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
                        .Select(QuizQuestion)
                        .ToList();
                    break;
                case QuizTypes.ReverseDirection:
                    vocabularyEntries = user
                        .VocabularyEntries
                        .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
                        .Take(20)
                        .Select(ReverseQuizQuestion)
                        .ToList();
                    break;
            }
            
            return vocabularyEntries;
        }

        private static QuizQuestion QuizQuestion(VocabularyEntry entry)
        {
            return new QuizQuestion
            {
                Id = Guid.NewGuid(),
                VocabularyEntry = entry,
                Question = entry.Word,
                Answer = entry.Definition,
                VocabularyEntryId = entry.Id
            };
        }
        
        private static QuizQuestion ReverseQuizQuestion(VocabularyEntry entry)
        {
            return new QuizQuestion
            {
                Id = Guid.NewGuid(),
                VocabularyEntry = entry,
                Question = entry.Definition,
                Answer = entry.Word,
                VocabularyEntryId = entry.Id
            };
        }
    }
}