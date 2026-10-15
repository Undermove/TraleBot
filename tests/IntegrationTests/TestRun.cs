using IntegrationTests;

/// <summary>
/// Runs once around every test in the assembly — it is outside any namespace on purpose: a set-up
/// fixture in a namespace wraps only the fixtures in that namespace.
/// </summary>
[SetUpFixture]
public class TestRun
{
    [OneTimeTearDown]
    public Task StopDatabase() => TestDatabase.StopAsync();
}
