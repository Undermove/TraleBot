using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using Domain.Quiz;
using MediatR;
using OneOf;

namespace Application.Quizzes.Commands.StartNewQuiz;

public class StartNewQuizCommand : IRequest<OneOf<QuizStarted, NotEnoughWords, QuizAlreadyStarted>>
{
    public required Guid? UserId { get; set; }
    public required string UserName { get; set; }
    
    public class Handler: IRequestHandler<StartNewQuizCommand, OneOf<QuizStarted, NotEnoughWords, QuizAlreadyStarted>>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IQuizCreator _quizCreator;
        private readonly IQuizVocabularyEntriesAdvisor _quizAdvisor;

        public Handler(ITraleDbContext dbContext, IQuizCreator quizCreator, IQuizVocabularyEntriesAdvisor quizAdvisor)
        {
            _dbContext = dbContext;
            _quizCreator = quizCreator;
            _quizAdvisor = quizAdvisor;
        }
        
        public async Task<OneOf<QuizStarted, NotEnoughWords, QuizAlreadyStarted>> Handle(StartNewQuizCommand request, CancellationToken ct)
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

            await _dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted == false);
            if (startedQuizzesCount > 0)
            {
                return new QuizAlreadyStarted();
            }
            
            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            var vocabularyEntriesByCurrentLanguage = user.VocabularyEntries
                .Where(entry => entry.Language == user.Settings.CurrentLanguage)
                .ToArray();
            
            var entriesForQuiz = _quizAdvisor.AdviceVocabularyEntriesForQuiz(vocabularyEntriesByCurrentLanguage).ToArray();
            var quizQuestions = _quizCreator
                .CreateQuizQuestions(entriesForQuiz, user.VocabularyEntries)
                .ToArray();

            if (entriesForQuiz.Length == 0)
            {
                return new NotEnoughWords();
            }
            
            await SaveQuiz(request, user, ct, quizQuestions, entriesForQuiz);
            
            await _dbContext.SaveChangesAsync(ct);
            var firstQuestion = quizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();
            return new QuizStarted(quizQuestions.Length, firstQuestion);
        }

        private async Task SaveQuiz(
            StartNewQuizCommand request,
            User user,
            CancellationToken ct,
            QuizQuestion[] quizQuestions,
            VocabularyEntry[] vocabularyEntries)
        {
            var shareableQuiz = new ShareableQuiz
            {
                Id = Guid.NewGuid(),
                QuizType = QuizTypes.SmartQuiz,
                DateAddedUtc = DateTime.UtcNow,
                CreatedByUser = user,
                CreatedByUserId = user.Id,
                CreatedByUserName = request.UserName,
                VocabularyEntriesIds = vocabularyEntries.Select(q => q.Id).ToList()
            };
            
            var quiz = new UserQuiz
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