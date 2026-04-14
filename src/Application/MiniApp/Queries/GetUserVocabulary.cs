using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using Application.Common.Interfaces.MiniApp;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.MiniApp.Queries;

public class GetUserVocabulary : IRequest<GetUserVocabularyResult>
{
    public required Guid UserId { get; init; }

    public class Handler(
        ITraleDbContext dbContext,
        IMiniAppContentProvider content)
        : IRequestHandler<GetUserVocabulary, GetUserVocabularyResult>
    {
        public async Task<GetUserVocabularyResult> Handle(GetUserVocabulary request, CancellationToken ct)
        {
            var user = await dbContext.Users
                .Include(u => u.Settings)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, ct);

            if (user == null)
            {
                return new GetUserVocabularyResult
                {
                    Language = string.Empty,
                    Items = new List<VocabularyItemDto>(),
                    StarterItems = new List<VocabularyItemDto>()
                };
            }

            var entries = await dbContext.VocabularyEntries
                .Where(v => v.UserId == user.Id && v.Language == user.Settings.CurrentLanguage)
                .OrderByDescending(v => v.DateAddedUtc)
                .ToListAsync(ct);

            var items = entries.Select(e => new VocabularyItemDto
            {
                Id = e.Id.ToString(),
                Word = e.Word,
                Definition = e.Definition,
                Example = e.Example,
                DateAddedUtc = e.DateAddedUtc,
                SuccessCount = e.SuccessAnswersCount,
                SuccessReverseCount = e.SuccessAnswersCountInReverseDirection,
                FailedCount = e.FailedAnswersCount,
                Mastery = e.GetMasteringLevel().ToString(),
                IsStarter = false
            }).ToList();

            var starters = content.GetStarterVocabulary()
                .Select(s => new VocabularyItemDto
                {
                    Id = "starter-" + s.Word,
                    Word = s.Word,
                    Definition = s.Definition,
                    Example = s.Example,
                    DateAddedUtc = null,
                    SuccessCount = 0,
                    SuccessReverseCount = 0,
                    FailedCount = 0,
                    Mastery = MasteringLevel.NotMastered.ToString(),
                    IsStarter = true
                }).ToList();

            return new GetUserVocabularyResult
            {
                Language = user.Settings.CurrentLanguage.ToString(),
                Items = items,
                StarterItems = items.Count == 0 ? starters : new List<VocabularyItemDto>()
            };
        }
    }
}

public class GetUserVocabularyResult
{
    public string Language { get; init; }
    public List<VocabularyItemDto> Items { get; init; }
    public List<VocabularyItemDto> StarterItems { get; init; }
}

public class VocabularyItemDto
{
    public string Id { get; init; }
    public string Word { get; init; }
    public string Definition { get; init; }
    public string Example { get; init; }
    public DateTime? DateAddedUtc { get; init; }
    public int SuccessCount { get; init; }
    public int SuccessReverseCount { get; init; }
    public int FailedCount { get; init; }
    public string Mastery { get; init; }
    public bool IsStarter { get; init; }
}
