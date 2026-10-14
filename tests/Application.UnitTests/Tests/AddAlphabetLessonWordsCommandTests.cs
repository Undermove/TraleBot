using Application.Achievements.Services.Triggers;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.MiniApp;
using Application.MiniApp.Commands;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Moq;
using Shouldly;

namespace Application.UnitTests.Tests;

/// <summary>
/// After a counted alphabet lesson its words go into the dictionary from the server's own list:
/// only for a counted lesson, without duplicates, earlier counted lessons included, achievements as for any word.
/// </summary>
public class AddAlphabetLessonWordsCommandTests : CommandTestsBase
{
    private sealed class Words : IAlphabetLessonWords
    {
        public IReadOnlyList<AlphabetWord> WordsOf(int lessonId) => lessonId switch
        {
            1 => [new("და", "и"), new("არა", "нет"), new("რა", "что")],
            2 => [new("სად", "где"), new("დედა", "мама")],
            _ => []
        };
    }

    private User _user = null!;
    private Mock<IAchievementsService> _achievements = null!;
    private AddAlphabetLessonWords.Handler _handler = null!;

    [SetUp]
    public async Task SetUp()
    {
        _achievements = new Mock<IAchievementsService>(MockBehavior.Strict);
        _achievements.Setup(a => a.AssignAchievements(It.IsAny<VocabularyCountTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _user = Create.User().WithCurrentLanguage(Language.Georgian).Build();
        Context.Users.Add(_user);
        await Context.SaveChangesAsync();
        _handler = new AddAlphabetLessonWords.Handler(Context, new Words(), _achievements.Object);
    }

    private async Task Completed(string json)
    {
        Context.MiniAppUserProgresses.Add(new MiniAppUserProgress
        {
            Id = Guid.NewGuid(), UserId = _user.Id, CompletedLessonsJson = json, UpdatedAtUtc = DateTime.UtcNow
        });
        await Context.SaveChangesAsync();
    }

    private Task<AddAlphabetLessonWordsResult> Add(int lesson) =>
        _handler.Handle(new AddAlphabetLessonWords { UserId = _user.Id, LessonId = lesson }, CancellationToken.None);

    private Task<List<VocabularyEntry>> Dictionary() =>
        Context.VocabularyEntries.Where(e => e.UserId == _user.Id).OrderBy(e => e.Word).ToListAsync();

    [Test]
    public async Task Adds_the_words_of_a_counted_lesson_as_Georgian_entries_with_the_lesson_translation()
    {
        await Completed("""{"alphabet-progressive":[1]}""");

        var result = (await Add(1)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();

        result.AddedCount.ShouldBe(3);
        result.Words.Select(w => (w.Word, w.Translation, w.Added)).ShouldBe([("და", "и", true), ("არა", "нет", true), ("რა", "что", true)]);
        var entries = await Dictionary();
        entries.Count.ShouldBe(3);
        entries.ShouldAllBe(e => e.Language == Language.Georgian && e.Example == "");
        entries.Single(e => e.Word == "არა").Definition.ShouldBe("нет");
        _achievements.Verify(a => a.AssignAchievements(It.Is<VocabularyCountTrigger>(t => t.VocabularyEntriesCount == 3), _user.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Adds_nothing_for_a_lesson_that_is_not_counted()
    {
        await Completed("""{"alphabet-progressive":[2],"numbers":[1]}""");

        (await Add(1)).ShouldBeOfType<AddAlphabetLessonWordsResult.LessonNotCompleted>();

        (await Dictionary()).ShouldBeEmpty();
    }

    [Test]
    public async Task Adds_nothing_without_any_progress_and_answers_unknown_for_a_lesson_without_words()
    {
        (await Add(1)).ShouldBeOfType<AddAlphabetLessonWordsResult.LessonNotCompleted>();
        (await Add(42)).ShouldBeOfType<AddAlphabetLessonWordsResult.UnknownLesson>();
        (await Dictionary()).ShouldBeEmpty();
    }

    [Test]
    public async Task Keeps_a_word_the_learner_already_has_and_adds_nothing_the_second_time()
    {
        await Completed("""{"alphabet-progressive":[1]}""");
        Context.VocabularyEntries.Add(Create.VocabularyEntry().WithWord("და").WithDefinition("и, а").WithLanguage(Language.Georgian).WithUser(_user).Build());
        await Context.SaveChangesAsync();

        var first = (await Add(1)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();
        first.AddedCount.ShouldBe(2);
        first.Words.Single(w => w.Word == "და").Added.ShouldBeFalse();
        (await Dictionary()).Single(e => e.Word == "და").Definition.ShouldBe("и, а");

        var again = (await Add(1)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();
        again.AddedCount.ShouldBe(0);
        (await Dictionary()).Count.ShouldBe(3);
        _achievements.Verify(a => a.AssignAchievements(It.IsAny<VocabularyCountTrigger>(), _user.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Also_adds_the_missing_words_of_earlier_counted_lessons_but_answers_with_this_lesson_words()
    {
        await Completed("""{"alphabet-progressive":[1,2]}""");

        var result = (await Add(2)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();

        result.AddedCount.ShouldBe(5);
        result.Words.Select(w => w.Word).ShouldBe(["სად", "დედა"]);
        (await Dictionary()).Count.ShouldBe(5);
    }
}
