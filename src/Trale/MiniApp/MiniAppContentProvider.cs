using System;
using System.Collections.Generic;
using System.Linq;

namespace Trale.MiniApp;

/// <summary>
/// Serves catalog, theory and content for the Kutya Georgian mini-app.
/// All content lives here so the front-end doesn't hard-code it.
/// </summary>
public class MiniAppContentProvider : IMiniAppContentProvider
{
    private readonly CatalogDto _catalog;
    private readonly Dictionary<int, List<AlphabetLetterDto>> _alphabetLessonLetters;
    private readonly List<StarterWordDto> _starterVocabulary;

    public MiniAppContentProvider()
    {
        _alphabetLessonLetters = BuildAlphabetLessonLetters();
        _starterVocabulary = BuildStarterVocabulary();
        _catalog = BuildCatalog();
    }

    public CatalogDto GetCatalog() => _catalog;

    public List<AlphabetQuizQuestionDto> GetAlphabetLessonQuestions(int lessonId)
    {
        if (!_alphabetLessonLetters.TryGetValue(lessonId, out var letters))
        {
            return new();
        }

        var allLetters = _alphabetLessonLetters.Values.SelectMany(x => x).ToList();
        var random = new Random();
        var questions = new List<AlphabetQuizQuestionDto>();

        // Build 2 questions per letter in the lesson, mix directions.
        foreach (var letter in letters)
        {
            // Question A: letter → translit
            questions.Add(BuildLetterToTranslit(letter, allLetters, random));
            // Question B: translit → letter
            questions.Add(BuildTranslitToLetter(letter, allLetters, random));
        }

        return questions.OrderBy(_ => random.Next()).Take(Math.Min(10, questions.Count)).ToList();
    }

    public List<StarterWordDto> GetStarterVocabulary() => _starterVocabulary;

    private static AlphabetQuizQuestionDto BuildLetterToTranslit(
        AlphabetLetterDto target,
        List<AlphabetLetterDto> all,
        Random random)
    {
        var distractors = all
            .Where(l => l.Translit != target.Translit)
            .OrderBy(_ => random.Next())
            .Take(3)
            .Select(l => l.Translit)
            .ToList();

        var options = distractors.Append(target.Translit).OrderBy(_ => random.Next()).ToList();
        return new AlphabetQuizQuestionDto
        {
            Id = $"a-l2t-{target.Letter}",
            Question = $"Как читается буква {target.Letter} ?",
            Options = options,
            AnswerIndex = options.IndexOf(target.Translit),
            Explanation = $"{target.Letter} — {target.Translit}. Пример: {target.ExampleGe} ({target.ExampleRu})"
        };
    }

    private static AlphabetQuizQuestionDto BuildTranslitToLetter(
        AlphabetLetterDto target,
        List<AlphabetLetterDto> all,
        Random random)
    {
        var distractors = all
            .Where(l => l.Letter != target.Letter)
            .OrderBy(_ => random.Next())
            .Take(3)
            .Select(l => l.Letter)
            .ToList();

        var options = distractors.Append(target.Letter).OrderBy(_ => random.Next()).ToList();
        return new AlphabetQuizQuestionDto
        {
            Id = $"a-t2l-{target.Letter}",
            Question = $"Какая буква звучит как «{target.Translit}» ?",
            Options = options,
            AnswerIndex = options.IndexOf(target.Letter),
            Explanation = $"«{target.Translit}» — это {target.Letter}. Пример: {target.ExampleGe} ({target.ExampleRu})"
        };
    }

    private CatalogDto BuildCatalog()
    {
        return new CatalogDto
        {
            Modules = new List<ModuleDto>
            {
                BuildAlphabetModule(),
                BuildVerbsOfMovementModule(),
                BuildMyVocabularyModule()
            }
        };
    }

    private ModuleDto BuildAlphabetModule()
    {
        var lessons = new List<LessonDto>();
        foreach (var (lessonId, letters) in _alphabetLessonLetters.OrderBy(kv => kv.Key))
        {
            var first = letters.First().Letter;
            var last = letters.Last().Letter;
            var joined = string.Join(" ", letters.Select(l => l.Letter));

            lessons.Add(new LessonDto
            {
                Id = lessonId,
                Title = $"Буквы {first}–{last}",
                Short = joined,
                Theory = new LessonTheoryDto
                {
                    Title = $"Буквы {first}–{last}",
                    Goal = $"Запомнить {letters.Count} новых букв: их звучание и одно слово-пример на каждую.",
                    Blocks = new List<TheoryBlockDto>
                    {
                        new()
                        {
                            Type = "paragraph",
                            Text = "Тапни на каждую букву, прочитай её название и пример. Бомбора потом спросит."
                        },
                        new()
                        {
                            Type = "letters",
                            Letters = letters
                        }
                    }
                }
            });
        }

        return new ModuleDto
        {
            Id = "alphabet",
            Title = "Алфавит",
            Emoji = "🔤",
            Description = "33 буквы ქართული — по 4-5 за урок",
            Lessons = lessons
        };
    }

    private static ModuleDto BuildVerbsOfMovementModule()
    {
        return new ModuleDto
        {
            Id = "verbs-of-movement",
            Title = "Глаголы движения",
            Emoji = "🚶",
            Description = "მივდივარ, მოვდივარ, წავედი — куда, откуда, зачем",
            Lessons = new List<LessonDto>
            {
                Lesson(1, "Знакомство с глаголами", "идти, приходить, уходить...",
                    "Знакомство с глаголами движения",
                    "Выучить значения основных глаголов: идти, приходить, возвращаться, входить, выходить.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Грузинские глаголы движения строятся на корне-основе и приставке направления. В этом уроке запомним сами глаголы."),
                        List(
                            "წასვლა — идти, уходить",
                            "მოსვლა — приходить",
                            "დაბრუნება — возвращаться",
                            "შესვლა — входить",
                            "გასვლა — выходить",
                            "ასვლა — подниматься",
                            "ჩასვლა — спускаться",
                            "გადასვლა — переходить"),
                        Example("მე ვწავალ სახლში", "Я иду домой"),
                        Example("ის მოდის სკოლიდან", "Он идёт из школы")
                    }),

                Lesson(2, "Приставки направления", "მი-, მო-, წა-, შე-, გა-...",
                    "Приставки направления",
                    "Понимать движение по приставке: внутрь / наружу / вверх / вниз / к / от / через.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Приставка — ключ к смыслу. Она показывает, куда и относительно кого совершается движение."),
                        List(
                            "მივ- — к цели (მივ-დივარ)",
                            "მო- — к говорящему (მო-დის)",
                            "წა- — от говорящего (წა-ვიდა)",
                            "შე- — внутрь (შე-ვიდა)",
                            "გა- — наружу (გა-ვიდა)",
                            "ა- — вверх (ა-ვიდა)",
                            "ჩა- — вниз (ჩა-ვიდა)",
                            "გად- — через (გად-ა-ვიდა)"),
                        Example("ის შევიდა ოთახში", "Он вошёл в комнату"),
                        Example("ის გავიდა ოთახიდან", "Он вышел из комнаты")
                    }),

                Lesson(3, "Настоящее время", "მივდივარ, მიდიხარ, მიდის",
                    "Настоящее время",
                    "Научиться образовывать формы настоящего времени.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("В настоящем времени форма глагола показывает и направление, и лицо."),
                        List(
                            "მე — მივდივარ (я иду)",
                            "შენ — მიდიხარ (ты идёшь)",
                            "ის — მიდის (он/она идёт)",
                            "ჩვენ — მივდივართ (мы идём)",
                            "თქვენ — მიდიხართ (вы идёте)",
                            "ისინი — მიდიან (они идут)"),
                        Example("მე მივდივარ სახლში", "Я иду домой")
                    }),

                Lesson(4, "Прошедшее время", "მოვედი, წახვედი, მივიდა",
                    "Прошедшее время",
                    "Базовые формы прошедшего времени и направления.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Прошедшее образуется приставкой направления + основой + окончанием."),
                        List(
                            "მე — მივედი / მოვედი / წავედი",
                            "შენ — მიხვედი / მოხვედი / წახვედი",
                            "ის — მივიდა / მოვიდა / წავიდა",
                            "ჩვენ — მივედით / მოვედით / წავედით"),
                        Example("მე მოვედი სახლში", "Я пришёл домой")
                    }),

                Lesson(5, "Будущее — основы", "მოვალ, წავალ, მივალ",
                    "Будущее время — основы",
                    "Уметь образовывать будущее время и различать направления.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Будущее: приставка направления + основа + будущие окончания."),
                        List(
                            "მე — მივალ / მოვალ / წავალ",
                            "შენ — მიხვალ / მოხვალ / წახვალ",
                            "ის — მივა / მოვა / წავა"),
                        Example("ხვალ მე მივალ სამსახურში", "Завтра я приду на работу")
                    }),

                Lesson(6, "Прошедшее: спряжение", "все лица и числа",
                    "Прошедшее: спряжение",
                    "Все лица и числа в прошедшем времени, маркеры времени («вчера»).",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Повторяем спряжения в контексте временных маркеров."),
                        List(
                            "მე წავედი — я ушёл",
                            "ის წავიდა — он ушёл",
                            "ჩვენ წავედით — мы ушли",
                            "ისინი წავიდნენ — они ушли")
                    }),

                Lesson(7, "Закрепление прошедшего", "диалоги и контекст",
                    "Закрепление прошедшего",
                    "Различать настоящее и прошедшее в диалогах.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Вопросы: სად (где), საიდან (откуда), საით (куда). Маркеры: გუშინ (вчера), დღეს (сегодня)."),
                        Example("— გუშინ სად იყავი?", "— Где ты был вчера?"),
                        Example("— სკოლაში წავედი.", "— Я ходил в школу.")
                    }),

                Lesson(8, "Будущее — основы", "წავალ, მოვალ, დავბრუნდები",
                    "Будущее — основы",
                    "Отличать будущее время от настоящего.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Будущее делает акцент на результате: пойду / приду / дойду."),
                        List(
                            "მივდივარ → მივალ (иду → дойду)",
                            "მოვდივარ → მოვალ (прихожу → приду)",
                            "ვბრუნდები → დავბრუნდები (возвращаюсь → вернусь)")
                    }),

                Lesson(9, "Будущее: склонение", "все лица в будущем",
                    "Будущее: склонение",
                    "Все лица в будущем времени.",
                    new List<TheoryBlockDto>
                    {
                        List(
                            "მე — მივალ / მოვალ / წავალ",
                            "შენ — მიხვალ / მოხვალ / წახვალ",
                            "ის — მივა / მოვა / წავა",
                            "ჩვენ — მივალთ / მოვალთ / წავალთ",
                            "თქვენ — მიხვალთ / მოხვალთ / წახვალთ",
                            "ისინი — მივლენ / მოვლენ / წავლენ")
                    }),

                Lesson(10, "Итоговое закрепление", "все времена в миксе",
                    "Итоговое закрепление",
                    "Все времена, лица и направления в миксе.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("Финальный прогон. Следи за маркёрами времени и приставками направления."),
                        Example("გუშინ მე წავედი სკოლაში", "Вчера я ушёл в школу"),
                        Example("ხვალ ჩვენ დავბრუნდებით", "Завтра мы вернёмся")
                    }),

                Lesson(11, "Прошедшее несовершённое", "მივდიოდი — регулярные действия",
                    "Прошедшее несовершённое",
                    "Регулярные и повторяющиеся действия в прошлом.",
                    new List<TheoryBlockDto>
                    {
                        Paragraph("მივდიოდი — я ходил (много раз). Отличаем от одноразового მივედი."),
                        List(
                            "მე — მივდიოდი",
                            "ის — მივდიოდა",
                            "ჩვენ — მივდიოდით",
                            "ისინი — მივდიოდნენ")
                    })
            }
        };
    }

    private static ModuleDto BuildMyVocabularyModule()
    {
        return new ModuleDto
        {
            Id = "my-vocabulary",
            Title = "Мой словарь",
            Emoji = "📘",
            Description = "Слова из твоих переводов в боте — прогоняй их через квиз",
            Lessons = new List<LessonDto>()
        };
    }

    private static LessonDto Lesson(
        int id,
        string title,
        string shortText,
        string theoryTitle,
        string goal,
        List<TheoryBlockDto> blocks) => new()
    {
        Id = id,
        Title = title,
        Short = shortText,
        Theory = new LessonTheoryDto
        {
            Title = theoryTitle,
            Goal = goal,
            Blocks = blocks
        }
    };

    private static TheoryBlockDto Paragraph(string text) => new() { Type = "paragraph", Text = text };

    private static TheoryBlockDto List(params string[] items) => new()
    {
        Type = "list",
        Items = items.ToList()
    };

    private static TheoryBlockDto Example(string ge, string ru) => new()
    {
        Type = "example",
        Ge = ge,
        Ru = ru
    };

    private static Dictionary<int, List<AlphabetLetterDto>> BuildAlphabetLessonLetters()
    {
        // All 33 letters, each with name/translit/example.
        var all = new List<AlphabetLetterDto>
        {
            new("ა", "ან", "а", "ავი", "злой"),
            new("ბ", "ბან", "б", "ბავშვი", "ребёнок"),
            new("გ", "გან", "г", "გული", "сердце"),
            new("დ", "დონ", "д", "დედა", "мама"),
            new("ე", "ენ", "э", "ენა", "язык"),
            new("ვ", "ვინ", "в", "ვაშლი", "яблоко"),
            new("ზ", "ზენ", "з", "ზამთარი", "зима"),
            new("თ", "თან", "т (мягкое)", "თვალი", "глаз"),
            new("ი", "ინ", "и", "ია", "фиалка"),
            new("კ", "კან", "к (твёрдое)", "კაცი", "мужчина"),
            new("ლ", "ლას", "л", "ლომი", "лев"),
            new("მ", "მან", "м", "მზე", "солнце"),
            new("ნ", "ნარ", "н", "ნინო", "Нино"),
            new("ო", "ონ", "о", "ოჯახი", "семья"),
            new("პ", "პარ", "п (твёрдое)", "პური", "хлеб"),
            new("ჟ", "ჟან", "ж", "ჟურნალი", "журнал"),
            new("რ", "რაე", "р", "რძე", "молоко"),
            new("ს", "სან", "с", "სახლი", "дом"),
            new("ტ", "ტარ", "т (твёрдое)", "ტყე", "лес"),
            new("უ", "უნ", "у", "უცხო", "чужой"),
            new("ფ", "ფარ", "ф/п (мягкое)", "ფული", "деньги"),
            new("ქ", "ქან", "к (мягкое)", "ქალი", "женщина"),
            new("ღ", "ღან", "гх (гортанное)", "ღამე", "ночь"),
            new("ყ", "ყარ", "къ (гортанное)", "ყავა", "кофе"),
            new("შ", "შინ", "ш", "შავი", "чёрный"),
            new("ჩ", "ჩინ", "ч (мягкое)", "ჩაი", "чай"),
            new("ც", "ცან", "ц (мягкое)", "ცა", "небо"),
            new("ძ", "ძილ", "дз", "ძაღლი", "собака"),
            new("წ", "წილ", "ц (твёрдое)", "წიგნი", "книга"),
            new("ჭ", "ჭარ", "ч (твёрдое)", "ჭიქა", "стакан"),
            new("ხ", "ხან", "х", "ხე", "дерево"),
            new("ჯ", "ჯან", "дж", "ჯიბე", "карман"),
            new("ჰ", "ჰაე", "х (придых.)", "ჰაერი", "воздух")
        };

        // Chunk into groups: 5 per lesson, last lesson gets the remainder (3).
        var result = new Dictionary<int, List<AlphabetLetterDto>>();
        var lessonId = 1;
        const int perLesson = 5;
        for (var i = 0; i < all.Count; i += perLesson)
        {
            var chunk = all.Skip(i).Take(perLesson).ToList();
            result[lessonId++] = chunk;
        }
        return result;
    }

    private static List<StarterWordDto> BuildStarterVocabulary()
    {
        return new List<StarterWordDto>
        {
            new("გამარჯობა", "здравствуй / привет", "გამარჯობა, როგორ ხარ?"),
            new("მადლობა", "спасибо", "დიდი მადლობა!"),
            new("კარგი", "хороший", "კარგი დღე!"),
            new("ლამაზი", "красивый", "ლამაზი ყვავილი"),
            new("წყალი", "вода", "მინდა წყალი"),
            new("პური", "хлеб", "პური და ყველი"),
            new("ყავა", "кофе", "ერთი ყავა, გთხოვთ"),
            new("ჩაი", "чай", "ცხელი ჩაი"),
            new("სახლი", "дом", "ჩემი სახლი"),
            new("ქალი", "женщина", "ეს ქალი"),
            new("კაცი", "мужчина", "კარგი კაცი"),
            new("ბავშვი", "ребёнок", "პატარა ბავშვი"),
            new("დედა", "мама", "ჩემი დედა"),
            new("მამა", "папа", "ჩემი მამა"),
            new("ძაღლი", "собака", "კარგი ძაღლი"),
            new("კატა", "кошка", "პატარა კატა"),
            new("ცა", "небо", "ლამაზი ცა"),
            new("მზე", "солнце", "ცხელი მზე"),
            new("მთვარე", "луна", "სავსე მთვარე"),
            new("წიგნი", "книга", "კარგი წიგნი")
        };
    }
}

public interface IMiniAppContentProvider
{
    CatalogDto GetCatalog();
    List<AlphabetQuizQuestionDto> GetAlphabetLessonQuestions(int lessonId);
    List<StarterWordDto> GetStarterVocabulary();
}

public class CatalogDto
{
    public List<ModuleDto> Modules { get; set; } = new();
}

public class ModuleDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<LessonDto> Lessons { get; set; } = new();
}

public class LessonDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Short { get; set; } = string.Empty;
    public LessonTheoryDto Theory { get; set; } = new();
}

public class LessonTheoryDto
{
    public string Title { get; set; } = string.Empty;
    public string Goal { get; set; } = string.Empty;
    public List<TheoryBlockDto> Blocks { get; set; } = new();
}

public class TheoryBlockDto
{
    public string Type { get; set; } = string.Empty;
    public string Text { get; set; }
    public List<string> Items { get; set; }
    public string Ge { get; set; }
    public string Ru { get; set; }
    public List<AlphabetLetterDto> Letters { get; set; }
}

public class AlphabetLetterDto
{
    public string Letter { get; set; }
    public string Name { get; set; }
    public string Translit { get; set; }
    public string ExampleGe { get; set; }
    public string ExampleRu { get; set; }

    public AlphabetLetterDto() { }

    public AlphabetLetterDto(string letter, string name, string translit, string exampleGe, string exampleRu)
    {
        Letter = letter;
        Name = name;
        Translit = translit;
        ExampleGe = exampleGe;
        ExampleRu = exampleRu;
    }
}

public class AlphabetQuizQuestionDto
{
    public string Id { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int AnswerIndex { get; set; }
    public string Explanation { get; set; } = string.Empty;
}

public class StarterWordDto
{
    public string Word { get; set; }
    public string Definition { get; set; }
    public string Example { get; set; }

    public StarterWordDto() { }

    public StarterWordDto(string word, string definition, string example)
    {
        Word = word;
        Definition = definition;
        Example = example;
    }
}
