using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;

namespace Application.Common;

public interface ITraleDbContext
{
    DbSet<User> Users { get; }
    DbSet<UserSettings> UsersSettings { get; }
    DbSet<VocabularyEntry> VocabularyEntries { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<QuizQuestion> QuizQuestions { get; }
    DbSet<Achievement> Achievements { get; }
    DbSet<ShareableQuiz> ShareableQuizzes { get; }
    DbSet<ProcessedUpdate> ProcessedUpdates { get; }
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
    EntityEntry Entry(object entity);

    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
}