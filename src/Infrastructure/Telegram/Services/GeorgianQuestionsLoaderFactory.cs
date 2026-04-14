using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Telegram.Services;

public class GeorgianQuestionsLoaderFactory : IGeorgianQuestionsLoaderFactory
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly IMemoryCache _cache;

    public GeorgianQuestionsLoaderFactory(ILoggerFactory loggerFactory, IMemoryCache cache)
    {
        _loggerFactory = loggerFactory;
        _cache = cache;
    }

    public IGeorgianQuestionsLoader CreateForLesson(int lessonNumber)
    {
        return CreateForModuleLesson("Lessons/GeorgianVerbsOfMovement", lessonNumber);
    }

    public IGeorgianQuestionsLoader CreateForModuleLesson(string subdirectory, int lessonNumber)
    {
        var cacheKey = $"questions:{subdirectory}:{lessonNumber}";
        return _cache.GetOrCreate(cacheKey, entry =>
        {
            // Question files never change at runtime — cache indefinitely
            entry.Priority = CacheItemPriority.NeverRemove;
            var fileName = lessonNumber == 1 ? "questions.json" : $"questions{lessonNumber}.json";
            var logger = _loggerFactory.CreateLogger<GeorgianQuestionsLoader>();
            return new GeorgianQuestionsLoader(logger, fileName, subdirectory);
        })!;
    }
}