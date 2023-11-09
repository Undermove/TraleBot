using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Queries.GetVocabularyEntriesList;

public class GetVocabularyEntriesList: IRequest<VocabularyEntriesListVm>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetVocabularyEntriesList, VocabularyEntriesListVm>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<VocabularyEntriesListVm> Handle(GetVocabularyEntriesList request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                return new VocabularyEntriesListVm
                {
                    VocabularyEntriesPages = Enumerable.Empty<VocabularyEntry[]>()
                };
            }

            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);

            IEnumerable<VocabularyEntry[]> vocabularyEntries = user
                .VocabularyEntries
                .Where(entry => entry.Language == user.Settings.CurrentLanguage)
                .OrderBy(entry => entry.DateAddedUtc)
                .ToList()
                .Chunk(30);

            var response = new VocabularyEntriesListVm
            {
                VocabularyEntriesPages = vocabularyEntries,
                VocabularyWordsCount = user.VocabularyEntries.Count,
            };
            
            return response;
        }
    }
}