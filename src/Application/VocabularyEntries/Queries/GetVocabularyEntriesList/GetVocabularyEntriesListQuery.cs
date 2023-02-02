using Application.Common;
using Application.Common.Extensions;
using Domain.Entities;
using MediatR;

namespace Application.VocabularyEntries.Queries.GetVocabularyEntriesList;

public class GetVocabularyEntriesListQuery: IRequest<VocabularyEntriesListVm>
{
    public Guid? UserId { get; set; }
    
    public class Handler: IRequestHandler<GetVocabularyEntriesListQuery, VocabularyEntriesListVm>
    {
        private readonly ITraleDbContext _dbContext;

        public Handler(ITraleDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<VocabularyEntriesListVm> Handle(GetVocabularyEntriesListQuery request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                return new VocabularyEntriesListVm
                {
                    VocabularyEntries = Enumerable.Empty<VocabularyEntry[]>()
                };
            }

            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);

            IEnumerable<VocabularyEntry[]> vocabularyEntries;
            if (user.IsActivePremium())
            {
                vocabularyEntries = user
                    .VocabularyEntries
                    .OrderBy(entry => entry.DateAdded)
                    .ToList()
                    .Chunk(30);
            }
            else
            {
                vocabularyEntries = user
                    .VocabularyEntries
                    .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                    .OrderBy(entry => entry.DateAdded)
                    .ToList()
                    .Chunk(30);
            }

            var response = new VocabularyEntriesListVm
            {
                VocabularyEntries = vocabularyEntries
            };
            
            return response;
        }
    }
}