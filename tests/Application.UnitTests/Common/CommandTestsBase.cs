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
}