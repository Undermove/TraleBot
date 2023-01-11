using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

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
            if (request.UserId == null)
            {
                throw new ArgumentException("User Id cannot be null");
            }

            object?[] keyValues = { request.UserId };
            var user = await _dbContext.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                return new VocabularyEntriesListVm
                {
                    VocabularyEntries = new List<VocabularyEntry>()
                };
            }

            await _dbContext.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            var vocabularyEntries = user
                .VocabularyEntries
                .Where(entry => entry.DateAdded > DateTime.Now.AddDays(-7))
                .ToList();
            
            var response = new VocabularyEntriesListVm
            {
                VocabularyEntries = vocabularyEntries
            };
            
            return response;
        }
    }
}