namespace Domain.Entities;

public class VerbCard
{
    public required Guid Id { get; set; }
    public required Guid VerbId { get; set; }
    public virtual GeorgianVerb Verb { get; set; }
    public required VerbExerciseType ExerciseType { get; set; }
    public required string Question { get; set; } // вопрос на русском
    public required string QuestionGeorgian { get; set; } // вопрос на грузинском
    public required string CorrectAnswer { get; set; } // правильный ответ на грузинском
    public required string[] IncorrectOptions { get; set; } // неправильные варианты
    public required string Explanation { get; set; } // объяснение после ответа
    public required int TimeFormId { get; set; } // 1=present, 2=past, 3=future, 4=conditional
    public string? PersonNumber { get; set; } // "1sg", "3sg", "1pl" и т.д. для form-типа
}

public enum VerbExerciseType
{
    Form = 1,          // выбрать правильную форму (лицо, время, число)
    Cloze = 2,         // заполнить пропуск в предложении
    Sentence = 3,      // перевод / выбрать правильную фразу
    Prefix = 4         // выбрать правильную приставку
}