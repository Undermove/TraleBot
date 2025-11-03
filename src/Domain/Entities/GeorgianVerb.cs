namespace Domain.Entities;

public class GeorgianVerb
{
    public required Guid Id { get; set; }
    public required string Georgian { get; set; }
    public required string Russian { get; set; }
    public string? Prefix { get; set; } // შე-, ჩა-, გა-, ამ-, და-, გადა- и т.д.
    public string? Explanation { get; set; }
    public string? ExamplePresent { get; set; }
    public string? ExamplePast { get; set; }
    public string? ExampleFuture { get; set; }
    public int Difficulty { get; set; } // 1=A1, 2=A2, 3=B1, 4=B2
    public int Wave { get; set; } // группировка волн обучения
    public virtual ICollection<VerbCard> Cards { get; set; } = new List<VerbCard>();
    public virtual ICollection<StudentVerbProgress> StudentProgress { get; set; } = new List<StudentVerbProgress>();
}