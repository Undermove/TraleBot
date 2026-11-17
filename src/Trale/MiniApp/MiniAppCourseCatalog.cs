using System.Collections.Generic;
using System.Linq;
using Application.DailyTask;

namespace Trale.MiniApp;

/// <summary>The mini-app catalog for «Задание дня»: built once, the catalog does not change while the app runs.</summary>
public class MiniAppCourseCatalog(ITraleMiniAppContentProvider content) : ICourseCatalog
{
    /// <summary>The owner when <c>BotConfiguration.OwnerTelegramId</c> is not set — as in the admin screens.</summary>
    public const long DefaultOwnerTelegramId = 309149393;

    private IReadOnlyList<CourseModule>? _modules;

    public IReadOnlyList<CourseModule> Modules() => _modules ??= content.GetCatalog().Modules
        .Select(m => new CourseModule(m.Id, m.Title, m.Lessons.Select(l => new CourseLesson(l.Id, l.Title)).ToList()))
        .ToList();
}
