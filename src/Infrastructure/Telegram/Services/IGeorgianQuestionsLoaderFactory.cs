namespace Infrastructure.Telegram.Services;

public interface IGeorgianQuestionsLoaderFactory
{
    IGeorgianQuestionsLoader CreateForLesson(int lessonNumber);
    IGeorgianQuestionsLoader CreateForModuleLesson(string subdirectory, int lessonNumber);
}