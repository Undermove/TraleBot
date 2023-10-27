using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.VocabularyEntries.Queries.GetVocabularyEntriesList;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class GetVocabularyEntriesListQueryTests : CommandTestsBase
{
    private GetVocabularyEntriesListQuery.Handler _sut;

    public GetVocabularyEntriesListQueryTests(GetVocabularyEntriesListQuery.Handler sut)
    {
        _sut = sut;
    }

    [SetUp]
    public void SetUp()
    {
        _sut = new GetVocabularyEntriesListQuery.Handler(Context);
    }

    [Test]
    public async Task ShouldReturnBothOldAndNewVocabularyEntriesForFreeUser()
    {
        var premiumUser = await CreatePremiumUser();
        var oldVocabularyEntry = AddOldVocabularyEntry(premiumUser);
        var newVocabularyEntry = AddNewVocabularyEntry(premiumUser, oldVocabularyEntry);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new GetVocabularyEntriesListQuery()
        {
            UserId = premiumUser.Id
        }, CancellationToken.None);
        
        result.VocabularyEntriesPages.Count().ShouldBe(1);
        result.VocabularyEntriesPages.First().ShouldContain(oldVocabularyEntry);
        result.VocabularyEntriesPages.First().ShouldContain(newVocabularyEntry);
    }

    private static VocabularyEntry AddOldVocabularyEntry(User premiumUser)
    {
        var yearAgo = DateTime.UtcNow.Subtract(TimeSpan.FromDays(365));
        var oldVocabularyEntry = Create
            .VocabularyEntry()
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
        Context.VocabularyEntries.AddRange(oldVocabularyEntry, newVocabularyEntry);
        return newVocabularyEntry;
    }
}