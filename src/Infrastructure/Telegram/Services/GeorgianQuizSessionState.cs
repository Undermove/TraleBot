namespace Infrastructure.Telegram.Services;

public class GeorgianQuizSessionState
{
    public long UserId { get; set; }
    public int LessonId { get; set; }
    public List<QuizQuestionData> Questions { get; set; } = new();
    public int CurrentQuestionIndex { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int IncorrectAnswersCount { get; set; }
    public List<string> WeakVerbs { get; set; } = new();
    public DateTime StartedAt { get; set; }
    public string QuizFeedbackText { get; set; } = string.Empty;
}

public class QuizQuestionData
{
    public string Id { get; set; } = string.Empty;
    public string Lemma { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int AnswerIndex { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    /// <summary>"choice" (default), "type" (user types on Georgian keyboard), "audio-choice" (listen and pick), or "sentence-builder" (arrange chips).</summary>
    public string? QuestionType { get; set; }

    /// <summary>URL of the audio file for audio-choice questions, e.g. /audio/ka/alphabet_ga.mp3. Null for other types.</summary>
    public string? AudioUrl { get; set; }

    /// <summary>Georgian word/phrase the audio contains (displayed as caption after answering). Null for other types.</summary>
    public string? Transcript { get; set; }

    /// <summary>Target sentence in Russian for sentence-builder questions (e.g. "Я иду домой"). Null for other types.</summary>
    public string? TargetSentenceRu { get; set; }

    /// <summary>Correct token order defining the Georgian answer (e.g. ["მე","სახლში","მივდივარ"]). Null for other types.</summary>
    public List<string>? CorrectOrder { get; set; }

    /// <summary>Full chip pool including distractors. Null for other types.</summary>
    public List<string>? ChipPool { get; set; }

    /// <summary>Pre-filled slots (position → token). Null for other types.</summary>
    public List<SentenceBuilderPreset>? PresetPositions { get; set; }

    /// <summary>Slot-index → hint text (e.g. {"1":"Постпозиция -ში..."}). Null for other types.</summary>
    public Dictionary<string, string>? Hints { get; set; }

    public void ShuffleOptions(Random random)
    {
        if (Options.Count <= 1)
            return;

        var correctAnswer = Options[AnswerIndex];
        var shuffledOptions = Options.OrderBy(_ => random.Next()).ToList();

        Options = shuffledOptions;
        AnswerIndex = Options.IndexOf(correctAnswer);
    }
}

public record SentenceBuilderPreset(int Position, string Token);