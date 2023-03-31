using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CompleteQuiz;

public class CompleteQuizCommand : IRequest<QuizCompletionStatistics>
{
    public Guid? UserId { get; init; }

    public class Handler : IRequestHandler<CompleteQuizCommand, QuizCompletionStatistics>
    {
        private readonly ITraleDbContext _dbContext;
        private readonly IAchievementsService _achievementsService;

        public Handler(ITraleDbContext dbContext, IAchievementsService achievementsService)
        {
            _dbContext = dbContext;
            _achievementsService = achievementsService;
        }

        public async Task<QuizCompletionStatistics> Handle(CompleteQuizCommand request, CancellationToken ct)
        {
            var quiz = await _dbContext.Quizzes
                .FirstAsync(quiz => quiz.UserId == request.UserId &&
                               quiz.IsCompleted == false, 
                    cancellationToken: ct);
            quiz.IsCompleted = true;
            await _dbContext.SaveChangesAsync(ct);

            await CheckAchievements(request, quiz, ct);

            return new QuizCompletionStatistics(quiz.CorrectAnswersCount, quiz.IncorrectAnswersCount);
        }

        private async Task CheckAchievements(CompleteQuizCommand request, Quiz quiz, CancellationToken ct)
        {
            var vocabularyEntries = await _dbContext.VocabularyEntries
                .Where(entry => entry.UserId == request.UserId).ToListAsync(ct);
            var goldMedalsCount = vocabularyEntries
                .Count(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection);
            var brilliantsCount = vocabularyEntries
                .Count(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInBothDirections);
            
            var kingOfScoreTrigger = new GoldMedalsTrigger
            {
                GoldMedalWordsCount = goldMedalsCount,
                BrilliantWordsCount = brilliantsCount 
            };
            await _achievementsService.AssignAchievements(kingOfScoreTrigger, request.UserId.Value, ct);

            var count = await _dbContext.Quizzes
                .Where(quiz => quiz.UserId == request.UserId)
                .CountAsync(cancellationToken: ct);
            var startingQuizzerTrigger = new StartingQuizzerTrigger
            {
                QuizzesCount = count,  
            };
            await _achievementsService.AssignAchievements(startingQuizzerTrigger, request.UserId.Value, ct);
            
            var perfectQuizTrigger = new PerfectQuizTrigger
            {
                IncorrectAnswersCount = quiz.IncorrectAnswersCount,
                WordsCount = quiz.CorrectAnswersCount + quiz.IncorrectAnswersCount,
            };
            await _achievementsService.AssignAchievements(perfectQuizTrigger, request.UserId.Value, ct);
        }
    }
}