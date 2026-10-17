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
/// After a counted «Знакомство» lesson its phrases and scene words go into the dictionary from the server's own
/// list: only for a counted intro lesson, without duplicates, earlier counted lessons included.
/// </summary>
public class AddIntroLessonWordsCommandTests : CommandTestsBase
{
    private sealed class Words : IIntroLessonWords
    {
        public IReadOnlyList<AlphabetWordLesson> WordLessons { get; } =
        [
            new(1, 0, [new("გამარჯობა", "здравствуй"), new("ნახვამდის", "до свидания")]),
            new(3, 0, [new("როგორ ხარ?", "как дела?"), new("პური", "хлеб")])
        ];

        public IReadOnlyList<AlphabetWord> WordsOf(int lessonId) => WordLessons.FirstOrDefault(l => l.Id == lessonId)?.Words ?? [];
    }

    private User _user = null!;
    private Mock<IAchievementsService> _achievements = null!;
    private AddIntroLessonWords.Handler _handler = null!;

    [SetUp]
    public async Task SetUp()
    {
        _achievements = new Mock<IAchievementsService>(MockBehavior.Strict);
        _achievements.Setup(a => a.AssignAchievements(It.IsAny<VocabularyCountTrigger>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _user = Create.User().WithCurrentLanguage(Language.Georgian).Build();
        Context.Users.Add(_user);
        await Context.SaveChangesAsync();
        _handler = new AddIntroLessonWords.Handler(Context, new Words(), _achievements.Object);
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
        _handler.Handle(new AddIntroLessonWords { UserId = _user.Id, LessonId = lesson }, CancellationToken.None);

    private Task<List<VocabularyEntry>> Dictionary() =>
        Context.VocabularyEntries.Where(e => e.UserId == _user.Id).OrderBy(e => e.Word).ToListAsync();

    [Test]
    public async Task Adds_the_words_of_this_and_earlier_counted_intro_lessons_once()
    {
        await Completed("""{"intro":[1,3]}""");

        var result = (await Add(3)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();

        result.AddedCount.ShouldBe(4);
        result.Words.Select(w => w.Word).ShouldBe(["როგორ ხარ?", "პური"]);
        (await Dictionary()).Single(e => e.Word == "პური").Definition.ShouldBe("хлеб");

        var again = (await Add(3)).ShouldBeOfType<AddAlphabetLessonWordsResult.Success>();
        again.AddedCount.ShouldBe(0);
        (await Dictionary()).Count.ShouldBe(4);
    }

    [Test]
    public async Task Counts_only_intro_progress_and_knows_only_intro_lessons()
    {
        await Completed("""{"alphabet-progressive":[3]}""");

        (await Add(3)).ShouldBeOfType<AddAlphabetLessonWordsResult.LessonNotCompleted>();
        (await Add(2)).ShouldBeOfType<AddAlphabetLessonWordsResult.UnknownLesson>();
        (await Dictionary()).ShouldBeEmpty();
    }
}
