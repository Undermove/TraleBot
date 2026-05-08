using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Infrastructure.Telegram.Services;

namespace Infrastructure.UnitTests;

public class GeorgianQuestionsLoaderTests
{
    // Helper: write JSON to a temp file, create loader, clean up after test
    private static (GeorgianQuestionsLoader loader, string path) CreateLoaderFromJson(
        string json, ILogger<GeorgianQuestionsLoader>? logger = null)
    {
        var path = Path.Combine(Path.GetTempPath(), $"gql_test_{Guid.NewGuid()}.json");
        File.WriteAllText(path, json);
        var l = new GeorgianQuestionsLoader(
            logger ?? NullLogger<GeorgianQuestionsLoader>.Instance,
            path);
        return (l, path);
    }

    [Test]
    public void LoadQuestions_SentenceBuilderType_DeserialisesDtoCorrectly()
    {
        var json = """
        {
          "lesson_id": "test-sb",
          "questions": [
            {
              "id": "sb-001",
              "lemma": "სახლში",
              "question": "Собери предложение",
              "answer_index": 0,
              "questionType": "sentence-builder",
              "level": 1,
              "targetSentence": { "ru": "Я дома" },
              "correctOrder": ["მე", "სახლში", "ვარ"],
              "chipPool": ["სახლში", "სახლი", "მე", "ვარ"],
              "presetPositions": [{ "position": 0, "token": "მე" }],
              "hints": { "1": "подсказка" }
            }
          ]
        }
        """;

        var (loader, path) = CreateLoaderFromJson(json);
        try
        {
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.QuestionType.ShouldBe("sentence-builder");
            q.SentenceBuilder.ShouldNotBeNull();
        }
        finally { File.Delete(path); }
    }

    [Test]
    public void LoadQuestions_SentenceBuilder_AllFieldsPopulated()
    {
        var json = """
        {
          "lesson_id": "test-sb",
          "questions": [
            {
              "id": "sb-002",
              "lemma": "სახლში",
              "question": "Собери предложение",
              "answer_index": 0,
              "questionType": "sentence-builder",
              "level": 2,
              "targetSentence": { "ru": "Я дома" },
              "correctOrder": ["მე", "სახლში", "ვარ"],
              "chipPool": ["სახლში", "სახლი", "მე", "ვარ", "extra"],
              "presetPositions": [
                { "position": 0, "token": "მე" },
                { "position": 2, "token": "ვარ" }
              ],
              "hints": { "1": "подсказка" }
            }
          ]
        }
        """;

        var (loader, path) = CreateLoaderFromJson(json);
        try
        {
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var sb = questions[0].SentenceBuilder!;
            sb.TargetSentence.Ru.ShouldBe("Я дома");
            sb.Level.ShouldBe(2);
            sb.CorrectOrder.ShouldBe(new[] { "მე", "სახლში", "ვარ" });
            sb.ChipPool.ShouldContain("სახლში");
            sb.ChipPool.Count.ShouldBe(5);
            sb.PresetPositions.Count.ShouldBe(2);
            sb.PresetPositions[0].Position.ShouldBe(0);
            sb.PresetPositions[0].Token.ShouldBe("მე");
            sb.PresetPositions[1].Position.ShouldBe(2);
            sb.PresetPositions[1].Token.ShouldBe("ვარ");
            sb.Hints["1"].ShouldBe("подсказка");
        }
        finally { File.Delete(path); }
    }

    [Test]
    public void LoadQuestions_MissingChipInPool_LogsWarningAndSkipsQuestion()
    {
        var json = """
        {
          "lesson_id": "test-sb-bad",
          "questions": [
            {
              "id": "sb-bad-001",
              "lemma": "სახლში",
              "question": "Собери предложение",
              "answer_index": 0,
              "questionType": "sentence-builder",
              "level": 1,
              "targetSentence": { "ru": "Я дома" },
              "correctOrder": ["მე", "სახლში", "ვარ"],
              "chipPool": ["სახლი", "ვარ"],
              "presetPositions": [],
              "hints": {}
            }
          ]
        }
        """;

        var mockLogger = new Mock<ILogger<GeorgianQuestionsLoader>>();
        var (loader, path) = CreateLoaderFromJson(json, mockLogger.Object);
        try
        {
            loader.LoadQuestionsForLesson(1);

            mockLogger.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.IsAny<It.IsAnyType>(),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.AtLeastOnce);
        }
        finally { File.Delete(path); }
    }

    [Test]
    public void LoadQuestions_MissingChipInPool_QuestionNotInLoadedList()
    {
        var json = """
        {
          "lesson_id": "test-sb-bad",
          "questions": [
            {
              "id": "sb-bad-002",
              "lemma": "სახლში",
              "question": "Bad question",
              "answer_index": 0,
              "questionType": "sentence-builder",
              "level": 1,
              "targetSentence": { "ru": "Я дома" },
              "correctOrder": ["მე", "MISSING_TOKEN", "ვარ"],
              "chipPool": ["სახლი", "ვარ"],
              "presetPositions": [],
              "hints": {}
            }
          ]
        }
        """;

        var (loader, path) = CreateLoaderFromJson(json);
        try
        {
            var questions = loader.LoadQuestionsForLesson(1);
            questions.ShouldBeEmpty();
        }
        finally { File.Delete(path); }
    }
}
