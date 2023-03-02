using System;
using Application.Common;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.UnitTests.Common;

public class TraleContextFactory
{
    public static TraleDbContext Create()
    {
        var options = new DbContextOptionsBuilder<TraleDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var context = new TraleDbContext(options);

        context.Database.EnsureCreated();

        context.SaveChanges();

        return context;
    }

    public static void Destroy(TraleDbContext context)
    {
        context.Database.EnsureDeleted();

        context.Dispose();
    }
}