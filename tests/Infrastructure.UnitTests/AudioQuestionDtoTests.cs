using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Infrastructure.Telegram.Services;

namespace Infrastructure.UnitTests;

// RED tests for #542: audioUrl/transcript fields on QuizQuestionData + GeorgianQuestionsLoader
public class AudioQuestionDtoTests
{
    [Test]
    public void QuizQuestionData_AudioUrl_IsNullByDefault()
    {
        var q = new QuizQuestionData();
        q.AudioUrl.ShouldBeNull();
        q.Transcript.ShouldBeNull();
    }

    [Test]
    public void GeorgianQuestionsLoader_ParsesAudioUrlAndTranscript()
    {
        var json = """
        {
          "lesson_id": "test-audio",
          "questions": [
            {
              "id": "q_audio_01",
              "lemma": "გამარჯობა",
              "question": "What do you hear?",
              "options": ["Hello", "Goodbye", "Thank you"],
              "answer_index": 0,
              "explanation": "გამარჯობა means hello.",
              "question_type": "audio-choice",
              "audio_url": "/audio/ka/alphabet_ga.mp3",
              "transcript": "გამარჯობა"
            }
          ]
        }
        """;

        var tmpFile = Path.Combine(Path.GetTempPath(), $"audio_test_{Guid.NewGuid()}.json");
        File.WriteAllText(tmpFile, json);
        try
        {
            var loader = new GeorgianQuestionsLoader(NullLogger<GeorgianQuestionsLoader>.Instance, tmpFile);
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.QuestionType.ShouldBe("audio-choice");
            q.AudioUrl.ShouldBe("/audio/ka/alphabet_ga.mp3");
            q.Transcript.ShouldBe("გამარჯობა");
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }

    [Test]
    public void GeorgianQuestionsLoader_AudioFields_AreNullForStandardChoiceQuestion()
    {
        var json = """
        {
          "lesson_id": "test-choice",
          "questions": [
            {
              "id": "q_choice_01",
              "lemma": "მადლობა",
              "question": "What does this mean?",
              "options": ["Thank you", "Hello", "Goodbye"],
              "answer_index": 0,
              "explanation": "მადლობა means thank you.",
              "question_type": "choice"
            }
          ]
        }
        """;

        var tmpFile = Path.Combine(Path.GetTempPath(), $"choice_test_{Guid.NewGuid()}.json");
        File.WriteAllText(tmpFile, json);
        try
        {
            var loader = new GeorgianQuestionsLoader(NullLogger<GeorgianQuestionsLoader>.Instance, tmpFile);
            var questions = loader.LoadQuestionsForLesson(1);

            questions.ShouldNotBeEmpty();
            var q = questions[0];
            q.QuestionType.ShouldBe("choice");
            q.AudioUrl.ShouldBeNull();
            q.Transcript.ShouldBeNull();
        }
        finally
        {
            File.Delete(tmpFile);
        }
    }
}
