using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Application.Common;

public interface ITraleDbContext
{
    DbSet<User> Users { get; }
    DbSet<VocabularyEntry> VocabularyEntries { get; }
    DbSet<Quiz> Quizzes { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
    EntityEntry Entry(object entity);
}