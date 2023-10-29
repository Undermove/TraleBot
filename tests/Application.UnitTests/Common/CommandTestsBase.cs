using Application.UnitTests.DSL;
using Domain.Entities;
using Persistence;

namespace Application.UnitTests.Common;

public abstract class CommandTestsBase : IDisposable
{
    protected TraleDbContext Context;

    protected CommandTestsBase()
    {
        Context = TraleContextFactory.Create();
    }

    public void Dispose()
    {
        TraleContextFactory.Destroy(Context);
    }
    
    [TearDown]
    public async Task TearDown()
    {
        await Context.Database.EnsureDeletedAsync();
        TraleContextFactory.Destroy(Context);
        Context = TraleContextFactory.Create();
    }
    
    protected async Task<User> SaveUser(Func<User> createUser)
    {
        var customUser = createUser();
        Context.Users.Add(customUser);
        await Context.SaveChangesAsync();
        return customUser;
    }
    
    protected async Task<User> CreatePremiumUser()
    {
        var premiumUser = Create.User().WithPremiumAccountType().Build();
        Context.Users.Add(premiumUser);
        await Context.SaveChangesAsync();
        return premiumUser;
    }
    
    protected async Task<User> CreateFreeUser()
    {
        var premiumUser = Create.User().Build();
        Context.Users.Add(premiumUser);
        await Context.SaveChangesAsync();
        return premiumUser;
    }
}