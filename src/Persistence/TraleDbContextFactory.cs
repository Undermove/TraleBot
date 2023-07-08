using Microsoft.EntityFrameworkCore;

namespace Persistence;

// ReSharper disable once UnusedType.Global
public class TraleDbContextFactory : DesignTimeDbContextFactoryBase<TraleDbContext>
{
    protected override TraleDbContext CreateNewInstance(DbContextOptions<TraleDbContext> options)
    {
        return new TraleDbContext(options);
    }
}