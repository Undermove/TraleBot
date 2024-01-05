using Application.Common;
using Application.Common.Exceptions;
using Domain.Entities;
using Domain.Quiz;
using MediatR;

namespace Application.Quizzes.Commands.StartNewQuiz;

public class StartNewQuizCommand : IRequest<StartNewQuizResult>
{
    public required Guid? UserId { get; set; }
    public required string UserName { get; set; }
    
    public class Handler(ITraleDbContext dbContext, IQuizCreator quizCreator, IQuizVocabularyEntriesAdvisor quizAdvisor)
        : IRequestHandler<StartNewQuizCommand, StartNewQuizResult>
    {
        public async Task<StartNewQuizResult> Handle(StartNewQuizCommand request, CancellationToken ct)
        {
            if (request.UserId == null)
            {
                throw new ArgumentException("User Id cannot be null");
            }

            object?[] keyValues = { request.UserId };
            var user = await dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new NotFoundException(nameof(User), request.UserId);
            }

            await dbContext.Entry(user).Collection(nameof(user.Quizzes)).LoadAsync(ct);
            var startedQuizzesCount = user.Quizzes.Count(q => q.IsCompleted == false);
            if (startedQuizzesCount > 0)
            {
                return new StartNewQuizResult.QuizAlreadyStarted();
            }
            
            await dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            var vocabularyEntriesByCurrentLanguage = user.VocabularyEntries
                .Where(entry => entry.Language == user.Settings.CurrentLanguage)
                .ToArray();
            
            var entriesForQuiz = quizAdvisor.AdviceVocabularyEntriesForQuiz(vocabularyEntriesByCurrentLanguage).ToArray();
            var quizQuestions = quizCreator
                .CreateQuizQuestions(entriesForQuiz, user.VocabularyEntries)
                .ToArray();

            if (entriesForQuiz.Length == 0)
            {
                return new StartNewQuizResult.NotEnoughWords();
            }
            
            await SaveQuiz(request, user, ct, quizQuestions, entriesForQuiz);
            
            await dbContext.SaveChangesAsync(ct);
            var firstQuestion = quizQuestions
                .OrderByDescending(entry => entry.OrderInQuiz)
                .Last();
            return new StartNewQuizResult.QuizStarted(quizQuestions.Length, firstQuestion);
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
                QuizQuestions = quizQuestions.ToList(),
                DateStarted = DateTime.UtcNow,
                IsCompleted = false,
                ShareableQuiz = shareableQuiz,
                ShareableQuizId = shareableQuiz.Id
            };
            
            await dbContext.Quizzes.AddAsync(quiz, ct);
        }
    }
}

public abstract record StartNewQuizResult
{
    public record QuizStarted(int QuizQuestionsCount, QuizQuestion FirstQuestion) : StartNewQuizResult;

    public record NotEnoughWords : StartNewQuizResult;

    public record QuizAlreadyStarted : StartNewQuizResult;
}