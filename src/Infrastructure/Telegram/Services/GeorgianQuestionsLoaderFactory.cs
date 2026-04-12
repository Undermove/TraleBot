using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuestionsLoaderFactory : IGeorgianQuestionsLoaderFactory
{
    private readonly ILoggerFactory _loggerFactory;

    public GeorgianQuestionsLoaderFactory(ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
    }

    public IGeorgianQuestionsLoader CreateForLesson(int lessonNumber)
    {
        return CreateForModuleLesson("GeorgianVerbsOfMovement", lessonNumber);
    }

    public IGeorgianQuestionsLoader CreateForModuleLesson(string subdirectory, int lessonNumber)
    {
        var fileName = lessonNumber == 1 ? "questions.json" : $"questions{lessonNumber}.json";
        var logger = _loggerFactory.CreateLogger<GeorgianQuestionsLoader>();
        return new GeorgianQuestionsLoader(logger, fileName, subdirectory);
    }
}