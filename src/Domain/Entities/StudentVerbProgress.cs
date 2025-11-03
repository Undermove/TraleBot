namespace Domain.Entities;

public class StudentVerbProgress
{
    public required Guid Id { get; set; }
    public required Guid UserId { get; set; }
    public virtual User User { get; set; }
    public required Guid VerbCardId { get; set; }
    public virtual VerbCard VerbCard { get; set; }
    
    // SRS поля
    public DateTime LastReviewDateUtc { get; set; }
    public DateTime NextReviewDateUtc { get; set; }
    public int IntervalDays { get; set; } = 1;
    
    // Статистика
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }
    public int CurrentStreak { get; set; }
    
    // Состояние
    public bool IsMarkedAsHard { get; set; }
    public int SessionCount { get; set; }
    public DateTime DateAddedUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    
    /// <summary>
    /// Получить следующий интервал повторения на основе оценки (1-5)
    /// </summary>
    public void UpdateFromRating(int rating) // 1=ошибка, 2=плохо, 3=нормально, 4=хорошо, 5=отлично
    {
        var intervalDays = rating switch
        {
            1 => 1,     // ❌ Ошибка
            2 => 2,     // 😐 Плохо
            3 => 2,     // 😐 Нормально
            4 => 4,     // ✅ Хорошо
            5 => 7,     // 🌟 Отлично
            _ => 1
        };

        // Если повторное отлично - переходим в долговременную память
        if (rating == 5 && IntervalDays >= 7)
        {
            intervalDays = 14;
        }

        IntervalDays = intervalDays;
        NextReviewDateUtc = DateTime.UtcNow.AddDays(intervalDays);
        LastReviewDateUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;

        // Обновляем счетчик правильных/неправильных
        if (rating >= 4)
        {
            CorrectAnswersCount++;
            CurrentStreak++;
        }
        else
        {
            IncorrectAnswersCount++;
            CurrentStreak = 0;
            IsMarkedAsHard = true; // Автоматически отмечаем как трудное при ошибке
        }

        SessionCount++;
    }
}