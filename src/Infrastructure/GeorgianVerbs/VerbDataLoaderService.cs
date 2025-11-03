using System.Text.Json;
using Application.Common;
using Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Infrastructure.GeorgianVerbs;

public interface IVerbDataLoaderService
{
    /// <summary>
    /// Загружает глаголы из JSON и генерирует карточки упражнений
    /// </summary>
    Task LoadVerbDataAsync(string jsonPath, ITraleDbContext context, CancellationToken ct);
}

public class VerbDataLoaderService : IVerbDataLoaderService
{
    private readonly ILogger<VerbDataLoaderService> _logger;

    public VerbDataLoaderService(ILogger<VerbDataLoaderService> logger)
    {
        _logger = logger;
    }

    public async Task LoadVerbDataAsync(string jsonPath, ITraleDbContext context, CancellationToken ct)
    {
        try
        {
            // Проверяем, есть ли уже загруженные глаголы
            if (context.GeorgianVerbs.Any())
            {
                _logger.LogInformation("Georgian verbs already loaded, skipping...");
                return;
            }

            var json = await File.ReadAllTextAsync(jsonPath, ct);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var verbGroups = JsonSerializer.Deserialize<List<VerbGroupDto>>(json, options);

            if (verbGroups == null || !verbGroups.Any())
            {
                _logger.LogWarning("No verb groups found in JSON");
                return;
            }

            var allVerbs = new List<GeorgianVerb>();
            var allCards = new List<VerbCard>();

            foreach (var group in verbGroups)
            {
                var waveNumber = group.Wave;

                foreach (var verbData in group.Verbs)
                {
                    var verb = new GeorgianVerb
                    {
                        Id = Guid.NewGuid(),
                        Georgian = verbData.Ka,
                        Russian = verbData.Ru,
                        Difficulty = ParseDifficulty(group.Difficulty),
                        Wave = waveNumber,
                        Explanation = group.Description
                    };

                    allVerbs.Add(verb);

                    // Генерируем карточки для этого глагола
                    var cards = GenerateVerbCards(verb);
                    allCards.AddRange(cards);
                }
            }

            // Сохраняем в БД
            await context.GeorgianVerbs.AddRangeAsync(allVerbs, ct);
            await context.SaveChangesAsync(ct);

            await context.VerbCards.AddRangeAsync(allCards, ct);
            await context.SaveChangesAsync(ct);

            _logger.LogInformation("Loaded {VerbCount} verbs with {CardCount} cards", allVerbs.Count, allCards.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading Georgian verbs data");
            throw;
        }
    }

    private List<VerbCard> GenerateVerbCards(GeorgianVerb verb)
    {
        var cards = new List<VerbCard>();

        // Для каждого глагола создаём 3 типа упражнений
        // 1. Form - выбрать правильную форму
        cards.Add(new VerbCard
        {
            Id = Guid.NewGuid(),
            VerbId = verb.Id,
            ExerciseType = VerbExerciseType.Form,
            Question = $"Какая форма глагола '{verb.Russian}' в 3 лице, единственном числе, настоящем времени?",
            QuestionGeorgian = $"რა ფორმა '{verb.Georgian}' გაგებით, სამი სინგულარში, მიმდინარე დროში?",
            CorrectAnswer = verb.Georgian, // Упрощённо - правильный ответ
            IncorrectOptions = new[] { $"{verb.Georgian}ს", $"{verb.Georgian}ი", $"{verb.Georgian}ო" },
            Explanation = $"✅ {verb.Georgian} - {verb.Russian} (3 лицо, единственное число, настоящее время)",
            TimeFormId = 1,
            PersonNumber = "3sg"
        });

        // 2. Cloze - заполнить пропуск
        cards.Add(new VerbCard
        {
            Id = Guid.NewGuid(),
            VerbId = verb.Id,
            ExerciseType = VerbExerciseType.Cloze,
            Question = $"Заполните пропуск: 'მე ___ ყოველ დღე' (Я ___ каждый день)",
            QuestionGeorgian = $"შეავსეთ ხარვეზი: 'მე ___ ყოველ დღე'",
            CorrectAnswer = verb.Georgian,
            IncorrectOptions = new[] { "ვ" + verb.Georgian, verb.Georgian + "ი", verb.Georgian + "ს" },
            Explanation = $"✅ Использование: მე {verb.Georgian} - Я {verb.Russian}",
            TimeFormId = 1,
            PersonNumber = "1sg"
        });

        // 3. Sentence - выбрать правильный перевод фразы
        cards.Add(new VerbCard
        {
            Id = Guid.NewGuid(),
            VerbId = verb.Id,
            ExerciseType = VerbExerciseType.Sentence,
            Question = $"Переведите: '{verb.Russian} в школу' (в контексте глагола)",
            QuestionGeorgian = $"თარგმნეთ: '{verb.Russian} სკოლაში'",
            CorrectAnswer = verb.Georgian,
            IncorrectOptions = new[] { "ვერ" + verb.Georgian, "არ" + verb.Georgian, "უნდა " + verb.Georgian },
            Explanation = $"✅ {verb.Russian} = {verb.Georgian}",
            TimeFormId = 1,
            PersonNumber = "3sg"
        });

        return cards;
    }

    private int ParseDifficulty(string difficulty)
    {
        return difficulty switch
        {
            "A1" => 1,
            "A2" => 2,
            "B1" => 3,
            "B2" => 4,
            "B1–B2" => 3,
            "A2–B1" => 2,
            _ => 1
        };
    }

    private record VerbGroupDto(
        string Id,
        string Title,
        string Description,
        string Difficulty,
        int Wave,
        List<VerbItemDto> Verbs);

    private record VerbItemDto(string Ka, string Ru, string? Note);
}