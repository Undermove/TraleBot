using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Quizzes.Commands.CompleteQuiz;

public class CompleteQuizCommand : IRequest<QuizCompletionStatistics>
{
    public Guid UserId { get; init; }

    public class Handler(ITraleDbContext dbContext, IAchievementsService achievementsService)
        : IRequestHandler<CompleteQuizCommand, QuizCompletionStatistics>
    {
        public async Task<QuizCompletionStatistics> Handle(CompleteQuizCommand request, CancellationToken ct)
        {
            var quiz = await dbContext.Quizzes
                .FirstAsync(quiz => quiz.UserId == request.UserId &&
                               quiz.IsCompleted == false, 
                    cancellationToken: ct);
            quiz.IsCompleted = true;
            await dbContext.SaveChangesAsync(ct);

            await CheckAchievements(request, quiz, ct);

            return new QuizCompletionStatistics(quiz.GetCorrectnessPercent(), quiz.CorrectAnswersCount, quiz.IncorrectAnswersCount);
        }

        private async Task CheckAchievements(CompleteQuizCommand request, Quiz quiz, CancellationToken ct)
        {
            var vocabularyEntries = await dbContext.VocabularyEntries
                .Where(entry => entry.UserId == request.UserId).ToListAsync(ct);
            var goldMedalsCount = vocabularyEntries
                .Count(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection);
            var brilliantsCount = vocabularyEntries
                .Count(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInBothDirections);
            
            var wordMasteringLevelTrigger = new WordMasteringLevelTrigger
            {
                GoldMedalWordsCount = goldMedalsCount,
                BrilliantWordsCount = brilliantsCount 
            };
            
            await achievementsService.AssignAchievements(wordMasteringLevelTrigger, request.UserId, ct);

            var count = await dbContext.Quizzes
                .Where(q => q.UserId == request.UserId)
                .CountAsync(cancellationToken: ct);
            
            var startingQuizzerTrigger = new StartingQuizzerTrigger
            {
                QuizzesCount = count,  
            };
            await achievementsService.AssignAchievements(startingQuizzerTrigger, request.UserId, ct);
            
            var perfectQuizTrigger = new PerfectQuizTrigger
            {
                IncorrectAnswersCount = quiz.IncorrectAnswersCount,
                WordsCount = quiz.CorrectAnswersCount + quiz.IncorrectAnswersCount,
            };
            await achievementsService.AssignAchievements(perfectQuizTrigger, request.UserId, ct);
        }
    }
}

public record QuizCompletionStatistics(double CorrectnessPercent, int CorrectAnswersCount, int IncorrectAnswersCount);