using Application.Achievements.Services.Checkers;
using Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Achievements.Queries;

public class GetAchievementsQuery : IRequest<AchievementsListVm>
{
    public required Guid UserId { get; init; }

    public class Handler : IRequestHandler<GetAchievementsQuery, AchievementsListVm>
    {
        private readonly ITraleDbContext _context;
        private readonly IEnumerable<IAchievementChecker<object>> _achievementCheckers;
        
        public Handler(ITraleDbContext context, IEnumerable<IAchievementChecker<object>> achievementCheckers)
        {
            _context = context;
            _achievementCheckers = achievementCheckers;
        }

        public async Task<AchievementsListVm> Handle(GetAchievementsQuery request, CancellationToken cancellationToken)
        {
            var unlockedAchievements = await _context.Achievements
                .Where(a => a.UserId == request.UserId)
                .Select(achievement => achievement.AchievementTypeId)
                .ToListAsync(cancellationToken: cancellationToken);

            var allAchievements = _achievementCheckers.Select(checker => new AchievementVm
            {
                Name = checker.Name,
                Description = checker.Description,
                Icon = checker.Icon,
                IsUnlocked = unlockedAchievements.Contains(checker.AchievementTypeId)
            }).ToList();
            
            var result = new AchievementsListVm { Achievements = allAchievements };
            return result;
        }
    }

    public void GetAchievements()
    {
        string achievementsMessage = """
    📊<b>Твои достижения:</b>
    🤪 Базовый разговорник – 10 слов в словаре
     
    🗣 Прокачанный болтун – 100 слов в словаре
      
    🧑‍🎓 Юный эрудит – 1000 слов в словаре
     
    ⭐ Начинающий квизёр – пройди свой первый квиз
     
    🤓 Перфекционист – заверши на 100% квиз с как минимум 10 словами.
     
    ✅ Решала – пройди на 100% квиз за неделю с 30 словами.
     
    ❓ Я только спросить – перевести слово, но не добавлять его в словарь
     
    😤 Сам знаю – перевести слово вручную
     
    🥉 Медалист – 10 слов с золотой медалью
     
    🥈 Серебряный призер – 100 слов с золотой медалью
     
    🥇 Король зачёта – 1000 слов с золотой медалью
     
    🏵 Аметист – 10 слов с бриллиантом в словаре
     
    🏆 Изумруд – 100 слов с бриллиантом в словаре
     
    💎 Я и есть словарь – 1000 слов с бриллиантом в словаре
    """;
    }
}