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
        var fileName = lessonNumber switch
        {
            1 => "questions.json",
            2 => "questions2.json",
            _ => throw new ArgumentException($"Unsupported lesson number: {lessonNumber}")
        };

        var logger = _loggerFactory.CreateLogger<GeorgianQuestionsLoader>();
        return new GeorgianQuestionsLoader(logger, fileName);
    }
}