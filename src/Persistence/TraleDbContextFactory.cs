using Microsoft.EntityFrameworkCore;

namespace Persistence;

public class TraleDbContextFactory : DesignTimeDbContextFactoryBase<TraleDbContext>
{
    protected override TraleDbContext CreateNewInstance(DbContextOptions<TraleDbContext> options)
    {
        return new TraleDbContext(options);
    }
}