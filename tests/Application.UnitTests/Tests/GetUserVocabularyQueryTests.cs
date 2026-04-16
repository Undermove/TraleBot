using Application.Common.Interfaces.MiniApp;
using Application.MiniApp.Queries;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

public class GetUserVocabularyQueryTests : CommandTestsBase
{
    private User _user = null!;
    private GetUserVocabulary.Handler _sut = null!;
    private Mock<IMiniAppContentProvider> _contentProvider = null!;

    [SetUp]
    public async Task SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _contentProvider = mockRepository.Create<IMiniAppContentProvider>();
        _contentProvider
            .Setup(p => p.GetStarterVocabulary())
            .Returns(new List<StarterWordDto>());

        _user = Create.User().WithCurrentLanguage(Language.Georgian).Build();
        Context.Users.Add(_user);
        await Context.SaveChangesAsync();

        _sut = new GetUserVocabulary.Handler(Context, _contentProvider.Object);
    }

    [Test]
    public async Task ShouldIncludeAdditionalInfoInDto()
    {
        const string expectedAdditionalInfo = "разговорное, также: ნამდვილად კარგად";
        var entry = Create.VocabularyEntry()
            .WithUser(_user)
            .WithLanguage(Language.Georgian)
            .WithAdditionalInfo(expectedAdditionalInfo)
            .Build();
        Context.VocabularyEntries.Add(entry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetUserVocabulary { UserId = _user.Id }, CancellationToken.None);

        result.Items.ShouldHaveSingleItem();
        result.Items[0].AdditionalInfo.ShouldBe(expectedAdditionalInfo);
    }

    [Test]
    public async Task ShouldReturnItemsForCorrectLanguageOnly()
    {
        var georgianEntry = Create.VocabularyEntry()
            .WithUser(_user)
            .WithLanguage(Language.Georgian)
            .WithWord("კარგი")
            .Build();
        var englishEntry = Create.VocabularyEntry()
            .WithUser(_user)
            .WithLanguage(Language.English)
            .WithWord("cat")
            .Build();
        Context.VocabularyEntries.AddRange(georgianEntry, englishEntry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetUserVocabulary { UserId = _user.Id }, CancellationToken.None);

        result.Items.ShouldHaveSingleItem();
        result.Items[0].Word.ShouldBe("კარგი");
    }

    [Test]
    public async Task ShouldReturnStarterItemsWhenUserHasNoEntries()
    {
        _contentProvider
            .Setup(p => p.GetStarterVocabulary())
            .Returns(new List<StarterWordDto>
            {
                new StarterWordDto("კარგი", "хорошо", "კარგი ადამიანი")
            });

        var result = await _sut.Handle(new GetUserVocabulary { UserId = _user.Id }, CancellationToken.None);

        result.Items.ShouldBeEmpty();
        result.StarterItems.ShouldHaveSingleItem();
        result.StarterItems[0].IsStarter.ShouldBeTrue();
        result.StarterItems[0].Word.ShouldBe("კარგი");
    }

    [Test]
    public async Task ShouldNotReturnStarterItemsWhenUserHasEntries()
    {
        _contentProvider
            .Setup(p => p.GetStarterVocabulary())
            .Returns(new List<StarterWordDto>
            {
                new StarterWordDto("კარგი", "хорошо", "კარგი ადამიანი")
            });

        var entry = Create.VocabularyEntry()
            .WithUser(_user)
            .WithLanguage(Language.Georgian)
            .Build();
        Context.VocabularyEntries.Add(entry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetUserVocabulary { UserId = _user.Id }, CancellationToken.None);

        result.Items.ShouldHaveSingleItem();
        result.StarterItems.ShouldBeEmpty();
    }
}
