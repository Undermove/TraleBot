using Application.Common;
using Application.Common.Exceptions;
using Application.Common.Extensions;
using Domain.Entities;
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
        
        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
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
            
            var quizQuestions = CreateQuizQuestions(user, request.QuizType);

            if (quizQuestions.Count == 0)
            {
                return new NotEnoughWords();
            }
            
            await SaveQuiz(request, ct, quizQuestions);

            return new QuizStarted(quizQuestions.Count);
        }

        private async Task SaveQuiz(StartNewQuizCommand request, CancellationToken ct, List<QuizQuestion> quizQuestions)
        {
            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId!.Value,
                QuizQuestions = quizQuestions,
                DateStarted = DateTime.UtcNow,
                IsCompleted = false
            };

            await _dbContext.Quizzes.AddAsync(quiz, ct);
            await _dbContext.SaveChangesAsync(ct);
        }

        private static List<QuizQuestion> CreateQuizQuestions(User user, QuizTypes quizType)
        {
            Random rnd = new Random();

            var vocabularyEntries = quizType switch
            {
                QuizTypes.LastWeek => user.VocabularyEntries.Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                    .OrderBy(entry => entry.DateAdded)
                    .Select(QuizQuestion)
                    .ToList(),
                QuizTypes.SeveralComplicatedWords => user.VocabularyEntries
                    .Where(entry => entry.SuccessAnswersCount < entry.FailedAnswersCount)
                    .OrderBy(_ => rnd.Next())
                    .Take(10)
                    .Select(QuizQuestion)
                    .ToList(),
                QuizTypes.ForwardDirection => user.VocabularyEntries
                    .Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
                    .OrderBy(entry => entry.DateAdded)
                    .Take(20)
                    .Select(QuizQuestion)
                    .ToList(),
                QuizTypes.ReverseDirection => user.VocabularyEntries
                    .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
                    .OrderBy(entry => entry.DateAdded)
                    .Take(20)
                    .Select(ReverseQuizQuestion)
                    .ToList(),
                _ => new List<QuizQuestion>()
            };

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
                Example = entry.Example
                    .ReplaceWholeWord(entry.Word, "______")
                    .ReplaceWholeWord(entry.Definition, "______"),
                VocabularyEntryId = entry.Id,
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
                Example = entry.Example
                    // remove word from example to avoid spoiling of correct answer
                    .ReplaceWholeWord(entry.Word, "______")
                    .ReplaceWholeWord(entry.Definition, "______"),
                VocabularyEntryId = entry.Id
            };
        }
    }
}