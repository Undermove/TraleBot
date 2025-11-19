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
            3 => "questions3.json",
            4 => "questions4.json",
            5 => "questions5.json",
            6 => "questions6.json",
            7 => "questions7.json",
            8 => "questions8.json",
            9 => "questions9.json",
            10 => "questions10.json",
            11 => "questions11.json",
            _ => throw new ArgumentException($"Unsupported lesson number: {lessonNumber}")
        };

        var logger = _loggerFactory.CreateLogger<GeorgianQuestionsLoader>();
        return new GeorgianQuestionsLoader(logger, fileName);
    }
}