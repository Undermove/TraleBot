using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Infrastructure.Telegram.Services;

namespace Infrastructure.UnitTests;

public class SentenceBuilderQuestionDtoTests
{
    [Test]
    public void QuizQuestionData_SentenceBuilderFields_AreNullByDefault()
    {
        var q = new QuizQuestionData();
        q.TargetSentenceRu.ShouldBeNull();
        q.CorrectOrder.ShouldBeNull();
        q.ChipPool.ShouldBeNull();
        q.PresetPositions.ShouldBeNull();
        q.Hints.ShouldBeNull();
    }

    [Test]
    public void GeorgianQuestionsLoader_ParsesSentenceBuilderQuestion_AllFields()
    {
        var json = """
        {
          "lesson_id": "test-sb",
          "questions": [
            {
              "id": "sb_q01",
              "lemma": "მე სახლში მივდივარ",
              "question": "Составь предложение",
              "options": [],
              "answer_index": 0,
              "explanation": "Я иду домой.",
              "question_type": "sentence-builder",
              "target_sentence": { "ru": "Я иду домой" },
              "correct_order": ["მე", "სახლში", "მივდივარ"],
              "chip_pool": ["მე", "სახლში", "მივდივარ", "ვარ"],
              "preset_positions": [
                { "position": 0, "token": "მე" }
              ],
              "hints": { "1": "Постпозиция -ში после слова" }
            }
          ]
        }
        """;

        var tmpFile = Path.Combine(Path.GetTempPath(), $"sb_test_{Guid.NewGuid()}.json");
        File.WriteAllText(tmpFile, json);
        try
        {
            var loader = new GeorgianQuestionsLoader(NullLogger<GeorgianQuestionsLoader>.Instance, tmpFile);
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.QuestionType.ShouldBe("sentence-builder");
            q.TargetSentenceRu.ShouldBe("Я иду домой");
            q.CorrectOrder.ShouldNotBeNull();
            q.CorrectOrder!.Count.ShouldBe(3);
            q.CorrectOrder[0].ShouldBe("მე");
            q.CorrectOrder[1].ShouldBe("სახლში");
            q.CorrectOrder[2].ShouldBe("მივდივარ");
            q.ChipPool.ShouldNotBeNull();
            q.ChipPool!.Count.ShouldBe(4);
            q.PresetPositions.ShouldNotBeNull();
            q.PresetPositions!.Count.ShouldBe(1);
            q.PresetPositions[0].Position.ShouldBe(0);
            q.PresetPositions[0].Token.ShouldBe("მე");
            q.Hints.ShouldNotBeNull();
            q.Hints!.ContainsKey("1").ShouldBeTrue();
            q.Hints["1"].ShouldBe("Постпозиция -ში после слова");
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }

    [Test]
    public void GeorgianQuestionsLoader_SentenceBuilderFields_AreNullForChoiceQuestion()
    {
        var json = """
        {
          "lesson_id": "test-choice",
          "questions": [
            {
              "id": "q_choice_01",
              "lemma": "გამარჯობა",
              "question": "What does this mean?",
              "options": ["Hello", "Goodbye", "Thank you"],
              "answer_index": 0,
              "explanation": "Hello."
            }
          ]
        }
        """;

        var tmpFile = Path.Combine(Path.GetTempPath(), $"choice_sb_test_{Guid.NewGuid()}.json");
        File.WriteAllText(tmpFile, json);
        try
        {
            var loader = new GeorgianQuestionsLoader(NullLogger<GeorgianQuestionsLoader>.Instance, tmpFile);
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.TargetSentenceRu.ShouldBeNull();
            q.CorrectOrder.ShouldBeNull();
            q.ChipPool.ShouldBeNull();
            q.PresetPositions.ShouldBeNull();
            q.Hints.ShouldBeNull();
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }

    [Test]
    public void GeorgianQuestionsLoader_SentenceBuilderQuestion_OptionalFieldsAbsent_NoException()
    {
        var json = """
        {
          "lesson_id": "test-sb-minimal",
          "questions": [
            {
              "id": "sb_q02",
              "lemma": "ის მიდის",
              "question": "Составь предложение",
              "options": [],
              "answer_index": 0,
              "explanation": "Он идёт.",
              "question_type": "sentence-builder",
              "target_sentence": { "ru": "Он идёт" },
              "correct_order": ["ის", "მიდის"],
              "chip_pool": ["ის", "მიდის", "მოდის"]
            }
          ]
        }
        """;

        var tmpFile = Path.Combine(Path.GetTempPath(), $"sb_minimal_test_{Guid.NewGuid()}.json");
        File.WriteAllText(tmpFile, json);
        try
        {
            var loader = new GeorgianQuestionsLoader(NullLogger<GeorgianQuestionsLoader>.Instance, tmpFile);
            List<QuizQuestionData> questions = null!;
            Should.NotThrow(() => questions = loader.LoadQuestionsForLesson(1));

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.QuestionType.ShouldBe("sentence-builder");
            q.TargetSentenceRu.ShouldBe("Он идёт");
            q.PresetPositions.ShouldBeNull();
            q.Hints.ShouldBeNull();
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }
}
