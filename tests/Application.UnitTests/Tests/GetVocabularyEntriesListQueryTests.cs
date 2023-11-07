using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class GetVocabularyEntriesListQueryTests : CommandTestsBase
{
    private GetVocabularyEntriesList.Handler _sut = null!;
    
    [SetUp]
    public void SetUp()
    {
        _sut = new GetVocabularyEntriesList.Handler(Context);
    }

    [Test]
    public async Task ShouldReturnBothOldAndNewVocabularyEntriesForFreeUser()
    {
        var premiumUser = await CreatePremiumUser();
        var oldVocabularyEntry = AddOldVocabularyEntry(premiumUser);
        var newVocabularyEntry = AddNewVocabularyEntry(premiumUser, oldVocabularyEntry);
        Context.VocabularyEntries.AddRange(oldVocabularyEntry, newVocabularyEntry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetVocabularyEntriesList()
        {
            UserId = premiumUser.Id
        }, CancellationToken.None);
        
        result.VocabularyEntriesPages.Count().ShouldBe(1);
        result.VocabularyEntriesPages.First().ShouldContain(oldVocabularyEntry);
        result.VocabularyEntriesPages.First().ShouldContain(newVocabularyEntry);
    }
    
    [Test]
    public async Task ShouldReturnEnglishWordsWhenCurrentLanguageIsEnglish()
    {
        var premiumUser = await SaveUser(Create.User().WithCurrentLanguage(Language.English).Build);
        var englishVocabularyEntry = Create
            .VocabularyEntry()
            .WithLanguage(Language.English)
            .WithUser(premiumUser)
            .Build();
        var georgianVocabularyEntry = Create
            .VocabularyEntry()
            .WithLanguage(Language.Georgian)
            .WithUser(premiumUser)
            .Build();
        Context.VocabularyEntries.AddRange(englishVocabularyEntry, georgianVocabularyEntry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetVocabularyEntriesList
        {
            UserId = premiumUser.Id
        }, CancellationToken.None);
        
        result.VocabularyEntriesPages.Count().ShouldBe(1);
        result.VocabularyEntriesPages.First().Length.ShouldBe(1);
        result.VocabularyEntriesPages.First().ShouldContain(englishVocabularyEntry);
    }
    
    [Test]
    public async Task ShouldReturnGeorgianWordsWhenCurrentLanguageIsGeorgian()
    {
        var premiumUser = await SaveUser(Create.User().WithCurrentLanguage(Language.Georgian).Build);
        var englishVocabularyEntry = Create
            .VocabularyEntry()
            .WithLanguage(Language.English)
            .WithUser(premiumUser)
            .Build();
        var georgianVocabularyEntry = Create
            .VocabularyEntry()
            .WithLanguage(Language.Georgian)
            .WithUser(premiumUser)
            .Build();
        Context.VocabularyEntries.AddRange(englishVocabularyEntry, georgianVocabularyEntry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetVocabularyEntriesList
        {
            UserId = premiumUser.Id
        }, CancellationToken.None);
        
        result.VocabularyEntriesPages.Count().ShouldBe(1);
        result.VocabularyEntriesPages.First().Length.ShouldBe(1);
        result.VocabularyEntriesPages.First().ShouldContain(georgianVocabularyEntry);
    }

    private static VocabularyEntry AddOldVocabularyEntry(User premiumUser)
    {
        var yearAgo = DateTime.UtcNow.Subtract(TimeSpan.FromDays(365));
        var oldVocabularyEntry = Create
            .VocabularyEntry()
            .WithLanguage(Language.English)
            .WithDateAdded(yearAgo)
            .WithUser(premiumUser)
            .Build();
        return oldVocabularyEntry;
    }

    private VocabularyEntry AddNewVocabularyEntry(User premiumUser, VocabularyEntry oldVocabularyEntry)
    {
        var addedNow = DateTime.UtcNow;
        var newVocabularyEntry = Create
            .VocabularyEntry()
            .WithDateAdded(addedNow)
            .WithUser(premiumUser)
            .Build();
        return newVocabularyEntry;
    }
}