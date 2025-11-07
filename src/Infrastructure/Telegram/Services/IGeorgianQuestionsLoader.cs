namespace Infrastructure.Telegram.Services;

public interface IGeorgianQuestionsLoader
{
    List<QuizQuestionData> LoadQuestionsForLesson(int lessonId);
}