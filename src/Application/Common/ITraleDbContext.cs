using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Common;

public interface ITraleDbContext
{
    DbSet<User> Users { get; }
    DbSet<VocabularyEntry> VocabularyEntries { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}