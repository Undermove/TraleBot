using Application.Common.Interfaces;
using Application.UnitTests.Common;
using Application.VocabularyEntries.Commands.CreateVocabularyEntryCommand;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests;

public class CreateVocabularyEntryCommandTests : CommandTestsBase
{
    private Mock<ITranslationService> _translationServicesMock = null!;

    [SetUp]
    public void SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        _translationServicesMock = mockRepository.Create<ITranslationService>();
    }

    [Test]
    public async Task ShouldSaveManualDefinitionWhenItComes()
    {
        var existingUser = Create.TestUser();
        Context.Users.Add(existingUser);
        await Context.SaveChangesAsync();
        var createSettingsCommandHandler = new CreateVocabularyEntryCommand.Handler(_translationServicesMock.Object, Context);

        const string expectedWord = "cat";
        const string expectedDefinition = "кошка";
        await createSettingsCommandHandler.Handle(new CreateVocabularyEntryCommand
        {
            UserId = existingUser.Id,
            Word = expectedWord,
            Definition = expectedDefinition
        }, CancellationToken.None);

        var vocabularyEntry = await Context.VocabularyEntries
            .FirstOrDefaultAsync(entry => entry.Word == expectedWord);
        vocabularyEntry.ShouldNotBeNull();
        vocabularyEntry.Definition.ShouldBe(expectedDefinition);
        vocabularyEntry.AdditionalInfo.ShouldBe(expectedDefinition);
    }
}