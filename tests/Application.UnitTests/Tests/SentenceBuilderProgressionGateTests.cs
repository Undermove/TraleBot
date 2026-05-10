using Application.MiniApp.Services;
using Shouldly;

namespace Application.UnitTests.Tests;

[TestFixture]
public class SentenceBuilderProgressionGateTests
{
    private static SentenceBuilderQuestionSlot Q(string id, int level) => new(id, level);

    // --- sub-cases (a) through (d) ---

    [Test]
    public void ProgressionGate_L4BlockedWhenL3NotMastered()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4), Q("q-l5-1", 5)
        };
        var mastery = new Dictionary<string, int>();

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldNotContain(q => q.Level == 4);
        result.ShouldNotContain(q => q.Level == 5);
    }

    [Test]
    public void ProgressionGate_L4UnlockedWhenL3Mastered()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4), Q("q-l5-1", 5)
        };
        var mastery = new Dictionary<string, int>
        {
            ["q-l3-1"] = 2,
            ["q-l3-2"] = 2
        };

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldContain(q => q.Level == 4);
        result.ShouldNotContain(q => q.Level == 5);
    }

    [Test]
    public void ProgressionGate_L5BlockedWhenL4NotMastered()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4), Q("q-l4-2", 4),
            Q("q-l5-1", 5)
        };
        // L3 mastered, L4 only partially answered
        var mastery = new Dictionary<string, int>
        {
            ["q-l3-1"] = 2, ["q-l3-2"] = 2,
            ["q-l4-1"] = 1  // only once — not yet mastered
        };

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldContain(q => q.Level == 4);
        result.ShouldNotContain(q => q.Level == 5);
    }

    [Test]
    public void ProgressionGate_L5UnlockedWhenL4Mastered()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4), Q("q-l4-2", 4),
            Q("q-l5-1", 5)
        };
        var mastery = new Dictionary<string, int>
        {
            ["q-l3-1"] = 2, ["q-l3-2"] = 2,
            ["q-l4-1"] = 2, ["q-l4-2"] = 2
        };

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldContain(q => q.Level == 4);
        result.ShouldContain(q => q.Level == 5);
    }

    // --- regression: L1/L2/L3 never filtered ---

    [Test]
    public void ProgressionGate_L1L2L3QuestionsAlwaysIncluded_GateDoesNotFilter()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l1-1", 1), Q("q-l2-1", 2), Q("q-l3-1", 3)
        };
        var mastery = new Dictionary<string, int>(); // no correct answers at all

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldContain(q => q.Level == 1);
        result.ShouldContain(q => q.Level == 2);
        result.ShouldContain(q => q.Level == 3);
    }

    // --- negative cases ---

    [Test]
    public void ProgressionGate_L4StillBlocked_WhenL3AnsweredOnlyOnce()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4)
        };
        var mastery = new Dictionary<string, int>
        {
            ["q-l3-1"] = 1, // answered only once — threshold is 2
            ["q-l3-2"] = 1
        };

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldNotContain(q => q.Level == 4);
    }

    [Test]
    public void ProgressionGate_L5Blocked_L4Available_WhenOnlyL3Mastered()
    {
        var questions = new List<SentenceBuilderQuestionSlot>
        {
            Q("q-l3-1", 3), Q("q-l3-2", 3),
            Q("q-l4-1", 4),
            Q("q-l5-1", 5)
        };
        var mastery = new Dictionary<string, int>
        {
            ["q-l3-1"] = 2,
            ["q-l3-2"] = 2
            // L4 not mastered at all
        };

        var result = SentenceBuilderProgressionGate.FilterByProgression(questions, mastery);

        result.ShouldContain(q => q.Level == 4);
        result.ShouldNotContain(q => q.Level == 5);
    }
}
