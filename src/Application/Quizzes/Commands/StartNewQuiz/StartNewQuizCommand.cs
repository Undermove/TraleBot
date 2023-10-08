using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using Domain.Quiz;
using MediatR;
using OneOf;

namespace Application.Quizzes.Commands.StartNewQuiz;

public class StartNewQuizCommand : IRequest<OneOf<QuizStarted, NotEnoughWords, NeedPremiumToActivate, QuizAlreadyStarted>>
{
    public Guid? UserId { get; set; }
    public QuizTypes QuizType { get; set; }
    
    public class Handler: IRequestHandler<StartNewQuizCommand, OneOf<QuizStarted, NotEnoughWords, NeedPremiumToActivate, QuizAlreadyStarted>>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IQuizCreator _quizCreator;

        public Handler(ITraleDbContext dbContext, IQuizCreator quizCreator)
        {
            _dbContext = dbContext;
            _quizCreator = quizCreator;
        }
        
        public async Task<OneOf<QuizStarted, NotEnoughWords, NeedPremiumToActivate, QuizAlreadyStarted>> Handle(StartNewQuizCommand request, CancellationToken ct)
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
                return new NeedPremiumToActivate();
            }

            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted == false);
            if (startedQuizzesCount > 0)
            {
                return new QuizAlreadyStarted();
            }
            
            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            
            var quizQuestions = _quizCreator.CreateQuizQuestions(user.VocabularyEntries, request.QuizType);

            if (quizQuestions.Count == 0)
            {
                return new NotEnoughWords();
            }
            
            await SaveQuiz(request, user, ct, quizQuestions);
            
            await _dbContext.SaveChangesAsync(ct);
            var firstQuestion = quizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();
            return new QuizStarted(quizQuestions.Count, firstQuestion);
        }

        private async Task SaveQuiz(
            StartNewQuizCommand request,
            User user,
            CancellationToken ct,
            List<QuizQuestion> quizQuestions)
        {
            var shareableQuiz = new ShareableQuiz
            {
                Id = Guid.NewGuid(),
                QuizType = request.QuizType,
                DateAddedUtc = DateTime.UtcNow,
                CreatedByUser = user,
                CreatedByUserId = user.Id,
                VocabularyEntriesIds = quizQuestions.Select(q => q.VocabularyEntry.Id).ToList()
            };
            
            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId!.Value,
                QuizQuestions = quizQuestions,
                DateStarted = DateTime.UtcNow,
                IsCompleted = false,
                ShareableQuiz = shareableQuiz,
                ShareableQuizId = shareableQuiz.Id
            };
            
            await _dbContext.Quizzes.AddAsync(quiz, ct);
        }
    }
}