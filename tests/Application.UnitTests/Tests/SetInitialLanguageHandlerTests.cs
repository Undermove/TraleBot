using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.Users.Commands;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class SetInitialLanguageHandlerTests : CommandTestsBase
{
    private SetInitialLanguage.Handler _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _sut = new SetInitialLanguage.Handler(Context);
    }

    [Test]
    public async Task ShouldSetInitialLanguage_ForUserWithoutInitialLanguage()
    {
        var user = await CreateFreeUserWithInitialLanguageSet(false);
        var result = await _sut.Handle(new SetInitialLanguage
        {
            UserId = user.Id,
            InitialLanguage = Language.Georgian
        }, CancellationToken.None);
        
        result.ShouldBeOfType<SetInitialLanguageResult.InitialLanguageSet>();
        user.Settings.CurrentLanguage.ShouldBe(Language.Georgian);
        user.InitialLanguageSet.ShouldBeTrue();
    }

    [Test]
    public async Task ShouldNotSetInitialLanguage_ForUserWithInitialLanguage()
    {
        var user = await CreateFreeUserWithInitialLanguageSet(true);
        var result = await _sut.Handle(new SetInitialLanguage
        {
            UserId = user.Id,
            InitialLanguage = Language.Georgian
        }, CancellationToken.None);
        
        result.ShouldBeOfType<SetInitialLanguageResult.InitialLanguageAlreadySet>();
        user.Settings.CurrentLanguage.ShouldBe(Language.English);
    }
    
    private async Task<User> CreateFreeUserWithInitialLanguageSet(bool initialLanguageSet)
    {
        var user = Create.User()
            .WithCurrentLanguage(Language.English)
            .WithInitialLanguageSet(initialLanguageSet)
            .Build();
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }
}