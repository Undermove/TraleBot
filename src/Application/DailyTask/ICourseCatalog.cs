using System.Collections.Generic;

namespace Application.DailyTask;

/// <summary>The course as the trainer sees it: modules with their lessons, in catalog order.</summary>
public interface ICourseCatalog
{
    IReadOnlyList<CourseModule> Modules();
}
