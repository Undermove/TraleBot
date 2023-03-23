using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Achievements;

public class GetAchievementsQuery : IRequest<AchievementsListVm>
{
    public required Guid UserId { get; init; }

    public class Handler : IRequestHandler<GetAchievementsQuery, AchievementsListVm>
    {
        private ITraleDbContext _context;

        public Handler(ITraleDbContext context)
        {
            _context = context;
        }

        public async Task<AchievementsListVm> Handle(GetAchievementsQuery request, CancellationToken cancellationToken)
        {
            var achievements =await _context.Achievements
                .Where(a => a.UserId == request.UserId)
                .ToListAsync(cancellationToken: cancellationToken);

            var result = new AchievementsListVm() { Achievements = achievements };
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

public class AchievementsListVm
{
    public required IList<Achievement> Achievements { get; init; }
}