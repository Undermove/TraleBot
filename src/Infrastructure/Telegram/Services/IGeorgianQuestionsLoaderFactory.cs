namespace Infrastructure.Telegram.Services;

public interface IGeorgianQuestionsLoaderFactory
{
    IGeorgianQuestionsLoader CreateForLesson(int lessonNumber);
}