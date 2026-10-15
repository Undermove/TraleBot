using Microsoft.EntityFrameworkCore;
using Npgsql;
using Persistence;
using Testcontainers.PostgreSql;

namespace IntegrationTests;

/// <summary>
/// One Postgres for the whole test run. The schema is migrated once into a template database, and every
/// fixture gets its own copy of it (<c>CREATE DATABASE … TEMPLATE</c>, a file copy that takes a fraction
/// of a second) — so fixtures never see each other's rows, and none of them waits for a container or
/// for the migrations again.
/// </summary>
public static class TestDatabase
{
    private const string Template = "trale_template";

    private static readonly SemaphoreSlim Lock = new(1, 1);
    private static PostgreSqlContainer? _container;

    /// <summary>A connection string to a fresh, fully migrated database of the fixture's own.</summary>
    public static async Task<string> CreateAsync()
    {
        await Lock.WaitAsync();
        try
        {
            _container ??= await StartContainer();

            var name = "t_" + Guid.NewGuid().ToString("N");
            await using (var connection = new NpgsqlConnection(_container.GetConnectionString()))
            {
                await connection.OpenAsync();
                await using var command = new NpgsqlCommand($"""CREATE DATABASE "{name}" TEMPLATE "{Template}" """, connection);
                await command.ExecuteNonQueryAsync();
            }

            return Database(name);
        }
        finally
        {
            Lock.Release();
        }
    }

    /// <summary>Drops a fixture's database once the fixture is done with it, so the run never piles them up.</summary>
    public static async Task DropAsync(string connectionString)
    {
        var name = new NpgsqlConnectionStringBuilder(connectionString).Database;
        NpgsqlConnection.ClearPool(new NpgsqlConnection(connectionString));

        await using var connection = new NpgsqlConnection(_container!.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"""DROP DATABASE IF EXISTS "{name}" WITH (FORCE)""", connection);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Stops the container at the end of the run (see <see cref="TestRun"/>, outside any namespace so that it wraps every fixture).</summary>
    internal static async Task StopAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    private static async Task<PostgreSqlContainer> StartContainer()
    {
        // WithAutoRemove instead of WithCleanUp: the agent runner mounts the host Docker socket and spawns
        // Postgres as a sibling container, where Ryuk (what WithCleanUp relies on) doesn't run reliably —
        // stopped Postgres containers piled up indefinitely. AutoRemove sets Docker's `--rm` flag so the
        // daemon deletes the container the moment it stops, regardless of Ryuk or whether DisposeAsync runs
        // (e.g. if the test process is killed mid-run). The two options are mutually exclusive.
        //
        // Fixtures run side by side, each with its own application, connection pool and Hangfire workers,
        // hence far more connections than the default 100. fsync is off: a test database never has to
        // survive a crash, and the data lives in memory, so the run touches no disk at all.
        var container = new PostgreSqlBuilder()
            .WithAutoRemove(true)
            .WithImage("postgres:16.1")
            .WithTmpfsMount("/var/lib/postgresql/data")
            .WithCommand("-c", "max_connections=1000", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off")
            .Build();
        await container.StartAsync();

        await using (var connection = new NpgsqlConnection(container.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"""CREATE DATABASE "{Template}" """, connection);
            await command.ExecuteNonQueryAsync();
        }

        // A database can only be copied while nobody is connected to it, hence no pooling here.
        var templateConnection = new NpgsqlConnectionStringBuilder(container.GetConnectionString()) { Database = Template, Pooling = false }.ToString();
        await using (var db = new TraleDbContext(new DbContextOptionsBuilder<TraleDbContext>().UseNpgsql(templateConnection).Options))
        {
            await db.Database.MigrateAsync();
        }

        return container;
    }

    private static string Database(string name) =>
        new NpgsqlConnectionStringBuilder(_container!.GetConnectionString()) { Database = name }.ToString();
}
