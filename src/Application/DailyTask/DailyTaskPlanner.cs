using System;
using System.Collections.Generic;
using System.Linq;
using Application.Translation.Languages;
using Domain.Entities;

namespace Application.DailyTask;

/// <summary>
/// Builds the task of the day out of what the learner already has: forms that are due, forms that
/// slipped, weak forms and their own dictionary. No model is involved: the mode and the level come
/// from thresholds, the content from fixed queues, the texts from templates.
/// Pure: the same input gives the same task.
/// </summary>
public static class DailyTaskPlanner
{
    public const int XpReward = 20;

    /// <summary>XP for an extra round played after the task.</summary>
    public const int XpExtra = 10;

    /// <summary>The accuracy assumed before the first game: it starts the learner on the middle level.</summary>
    public const int StartAccuracy = 78;

    /// <summary>A verb nobody touched for this long is brought back in the warm-up.</summary>
    private const int StaleDays = 21;

    /// <summary>Dictionary words added within these days and never trained count as fresh.</summary>
    private const int FreshDays = 7;

    /// <summary>After a break this long the task is the easiest one.</summary>
    private const int ComebackDays = 7;

    /// <summary>Mistakes in the last game from which the next day only repeats.</summary>
    private const int ManyErrors = 3;

    private const int Mastered = VerbFormProgress.MasteredStep;

    /// <param name="Back">Rounds from Russian into Georgian after the pairs.</param>
    private record LevelSpec(int Pairs, int Seconds, int Options, int Rounds, int Back);

    private static LevelSpec Spec(int level) => level switch
    {
        1 => new LevelSpec(3, 60, 2, 3, 3),
        2 => new LevelSpec(4, 45, 3, 5, 4),
        _ => new LevelSpec(5, 35, 3, 5, 5)
    };

    /// <summary>Tenses are never called by their textbook names in front of a learner.</summary>
    public static string TenseName(string tense) => tense switch
    {
        "present" => "сейчас",
        "aorist" => "прошедшее: сделал",
        "imperfect" => "прошедшее: делал",
        "future" => "будущее",
        "optative" => "надо сделать",
        "conditional" => "сделал бы",
        _ => tense
    };

    /// <summary>
    /// Forms and the course take turns: after fresh forms comes a lesson, after a lesson — forms.
    /// </summary>
    public static DailyNew? PickNew(DailyNew? portion, DailyNew? course, string? lastNew) =>
        (lastNew == DailyNew.Forms || portion == null) && course != null ? course : portion ?? course;

    /// <summary>The new accuracy after a game: recent games weigh more, one bad game does not drop the level.</summary>
    public static int NextAccuracy(int? accuracy, int errors)
    {
        var score = errors switch { <= 0 => 100, <= 2 => 80, <= 4 => 60, _ => 40 };
        var next = (int)Math.Round(0.6 * (accuracy ?? StartAccuracy) + 0.4 * score, MidpointRounding.AwayFromZero);
        return Math.Clamp(next, 40, 100);
    }

    public static DailyTaskDto Compose(DailyInput input)
    {
        var now = input.Now;
        var today = now.Date;
        var day = DateOnly.FromDateTime(today).ToString("yyyy-MM-dd");
        var random = new Random(input.Seed);
        var forms = input.Forms;
        var accuracy = input.Accuracy ?? StartAccuracy;

        var mode = input.Away >= ComebackDays ? DailyMode.Comeback
            : input.LastErrors >= ManyErrors || accuracy < 60 ? DailyMode.Review
            : DailyMode.Mix;
        var level = mode != DailyMode.Mix ? 1 : accuracy < 73 ? 1 : accuracy < 85 ? 2 : 3;
        var spec = Spec(level);

        // When each verb was last practised: recent verbs go first, long-unseen ones are "stale".
        var last = forms.GroupBy(f => f.Lemma).ToDictionary(g => g.Key, g => g.Max(f => f.UpdatedAtUtc));

        bool IsDue(DailyForm f) => f.Step == Mastered && f.DueAtUtc != null && f.DueAtUtc <= now;
        bool Slipped(DailyForm f) => f.Step < f.BestStep;

        var due = forms.Where(IsDue).OrderBy(f => f.DueAtUtc).ToList();
        var slip = forms.Where(Slipped)
            .OrderByDescending(f => last[f.Lemma]).ThenBy(f => f.Step).ThenByDescending(f => f.BestStep - f.Step)
            .ToList();
        var low = forms.Where(f => f.Step < Mastered && !Slipped(f))
            .OrderBy(f => f.Step).ThenByDescending(f => last[f.Lemma])
            .ToList();
        var staleVerbs = last.Where(v => (today - v.Value.Date).Days >= StaleDays)
            .OrderByDescending(v => v.Value).Select(v => v.Key)
            .ToList();
        var fresh = input.Words.Where(w => w.Ok + w.Bad == 0 && (today - w.AddedAtUtc.Date).Days <= FreshDays)
            .OrderByDescending(w => w.AddedAtUtc)
            .ToList();
        var weak = input.Words.Where(w => w.Bad > w.Ok).OrderByDescending(w => w.UpdatedAtUtc).ToList();
        var own = fresh.Concat(weak).Select(Item).Where(TileOk).ToList();

        // Warm-up: what the schedule brought today, then a verb that was not touched for long.
        var warm = new List<(DailyForm Form, bool Due)>();
        string? staleVerb = null;
        if (mode != DailyMode.Comeback)
        {
            warm.AddRange(due.Take(spec.Rounds).Select(f => (f, true)));
            if (mode == DailyMode.Mix && warm.Count < spec.Rounds && staleVerbs.Count > 0)
            {
                var stale = forms
                    .Where(f => f.Lemma == staleVerbs[0] && !Slipped(f) && warm.All(w => w.Form != f))
                    .OrderByDescending(f => f.Step)
                    .Take(spec.Rounds - warm.Count)
                    .ToList();
                if (stale.Count > 0)
                {
                    staleVerb = staleVerbs[0];
                    warm.AddRange(stale.Select(f => (f, false)));
                }
            }
        }

        var rounds = new List<DailyWarmRound>();
        foreach (var (form, isDue) in warm)
        {
            var wrong = Shuffle(forms.Where(o => o.Lemma == form.Lemma), random)
                .Concat(Shuffle(forms.Where(o => o.Lemma != form.Lemma), random))
                .Select(o => o.Ru)
                .Where(ru => ru != form.Ru)
                .Distinct()
                .Take(spec.Options - 1)
                .Select(ru => new DailyOption(ru, false))
                .ToList();
            if (wrong.Count == 0)
            {
                continue;
            }

            var options = Shuffle(wrong.Append(new DailyOption(form.Ru, true)), random);
            rounds.Add(new DailyWarmRound(Item(form), options, isDue));
        }

        var inWarm = rounds.Select(r => r.Item.Key).ToHashSet();

        // The game: a pair is never taken twice, neither by its Georgian nor by its Russian side.
        var pairs = new List<DailyItem>();
        void Take(IEnumerable<DailyItem> candidates, int upTo)
        {
            foreach (var item in candidates)
            {
                if (pairs.Count >= upTo)
                {
                    return;
                }

                if (pairs.All(p => p.Ka != item.Ka && p.Ru != item.Ru))
                {
                    pairs.Add(item);
                }
            }
        }

        IEnumerable<DailyItem> Tiles(IEnumerable<DailyForm> source) =>
            source.Where(f => !inWarm.Contains(f.Key)).Select(Item).Where(TileOk);

        if (mode == DailyMode.Comeback)
        {
            Take(Tiles(forms.OrderByDescending(f => f.Step).ThenByDescending(f => last[f.Lemma])), spec.Pairs);
        }
        else
        {
            var wantOwn = mode == DailyMode.Mix ? Math.Min(level - 1, own.Count) : 0;
            if (mode == DailyMode.Review)
            {
                Take(Tiles(forms.Where(f => input.Missed.Contains(f.Key) && f.Step < Mastered)), spec.Pairs);
            }

            Take(Tiles(slip), spec.Pairs - wantOwn);
            Take(Tiles(low), spec.Pairs - wantOwn);
            Take(own, spec.Pairs);
            Take(Tiles(low), spec.Pairs);
        }

        // Not enough of the usual: anything opened (longest unseen first), then the dictionary.
        Take(Tiles(forms.OrderBy(f => f.UpdatedAtUtc)), spec.Pairs);
        Take(input.Words.OrderByDescending(w => w.Bad - w.Ok).ThenBy(w => w.UpdatedAtUtc).Select(Item).Where(TileOk), spec.Pairs);

        if (pairs.Count < 2)
        {
            return new DailyTaskDto { Available = false, Day = day };
        }

        var mainVerb = pairs.Where(p => p.Lemma != null)
            .GroupBy(p => p.Lemma!)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .FirstOrDefault();
        var portion = Portion(input.Unopened, last, mainVerb);
        var next = mode == DailyMode.Review ? null : PickNew(portion, input.Course, input.LastNew);

        var verbForms = rounds.Select(r => r.Item).Concat(pairs).Count(i => i.Kind == "verb");
        var ownWords = pairs.Count(i => i.Kind == "word");
        var streakTail = input.PlayedToday ? ""
            : input.PlayedYesterday ? $", и в серии будет {Count(input.Streak + 1, "день", "дня", "дней")}"
            : ", и начнётся новая серия";

        string title;
        string button;
        var chat = new List<string>();
        switch (mode)
        {
            case DailyMode.Comeback:
                title = "Возвращение";
                button = "Вспомнить за минуту";
                chat.Add($"Давно не виделись: тебя не было {Count(input.Away, "день", "дня", "дней")}.");
                chat.Add(ownWords == 0
                    ? $"Начни с лёгкого: {Count(pairs.Count, "форма", "формы", "форм")} из тех, что ты знаешь лучше всего. Это одна минута{streakTail}."
                    : $"Начни с лёгкого: самое знакомое из того, что ты уже учил. Это одна минута{streakTail}.");
                break;

            case DailyMode.Review:
                title = "Закрепляем";
                button = "Повторить знакомое";
                chat.Add(input.LastErrors >= ManyErrors && input.LastTaskYesterday
                    ? "Вчера в игре было много ошибок."
                    : "В последних играх много ошибок.");
                chat.Add("Сегодня без новых слов и форм: повтори "
                         + (pairs.Any(p => input.Missed.Contains(p.Key)) ? "те, где были ошибки" : "то, что уже было")
                         + $". Это две минуты{streakTail}.");
                break;

            default:
                title = "Обычный день";
                button = "Повторить";
                chat.Add(MixReason(input, rounds, pairs, forms, staleVerb, last, Slipped));
                var what = verbForms > 0
                    ? Accusative(verbForms)
                      + (ownWords > 0 ? $" и {Count(ownWords, "слово", "слова", "слов")} из своего словаря" : "")
                    : $"{Count(ownWords, "слово", "слова", "слов")} из своего словаря";
                chat.Add($"Повтори сегодня {what}. Это две минуты{streakTail}.");
                break;
        }

        var check = Check(pairs, forms, input.Words, level, spec.Options, random);
        return new DailyTaskDto
        {
            Available = true,
            Day = day,
            Mode = mode,
            Level = level,
            Title = title,
            Chat = chat,
            Button = button,
            Why = Why(input, mode, level, due, slip, staleVerbs, fresh.Count, weak.Count, next),
            Seconds = spec.Seconds,
            Warm = rounds,
            Pairs = pairs,
            Back = Back(pairs.Concat(rounds.Select(r => r.Item)).Concat(Tiles(slip)).Concat(Tiles(low)), check, forms, input.Words, level, spec, random),
            Check = check,
            Next = next,
            Push = Push(input, mode, rounds, pairs, forms, staleVerb, Slipped)
        };
    }

    /// <summary>
    /// One more round after the task is done: what was practised longest ago, a couple of dictionary words,
    /// pairs, the way back and the check — no warm-up and nothing new. Null when there is nothing to build it from.
    /// </summary>
    public static DailyTaskDto? Extra(DailyInput input, IReadOnlySet<string> skip)
    {
        var random = new Random(input.Seed);
        var forms = input.Forms;
        var accuracy = input.Accuracy ?? StartAccuracy;
        var level = accuracy < 73 ? 1 : accuracy < 85 ? 2 : 3;
        var spec = Spec(level);

        var pairs = new List<DailyItem>();
        void Take(IEnumerable<DailyItem> candidates, int upTo)
        {
            foreach (var item in candidates.Where(i => !skip.Contains(i.Key) && TileOk(i)))
            {
                if (pairs.Count >= upTo)
                {
                    return;
                }

                if (pairs.All(p => p.Ka != item.Ka && p.Ru != item.Ru))
                {
                    pairs.Add(item);
                }
            }
        }

        var oldForms = forms.OrderBy(f => f.UpdatedAtUtc).ThenBy(f => f.Step).Select(Item).ToList();
        var oldWords = input.Words.OrderByDescending(w => w.Bad > w.Ok).ThenBy(w => w.UpdatedAtUtc).Select(Item).ToList();
        var wantWords = Math.Min(level, oldWords.Count);
        Take(oldForms, spec.Pairs - wantWords);
        Take(oldWords, spec.Pairs);
        Take(oldForms, spec.Pairs);

        if (pairs.Count < 2)
        {
            return null;
        }

        var check = Check(pairs, forms, input.Words, level, spec.Options, random);
        var day = DateOnly.FromDateTime(input.Now.Date).ToString("yyyy-MM-dd");
        return new DailyTaskDto
        {
            Available = true,
            Day = day,
            Mode = DailyMode.Mix,
            Level = level,
            Title = "Ещё раунд",
            Chat =
            [
                $"Ещё раунд: {What(pairs)} — то, что давно не повторялось.",
                $"Пары, потом с русского на грузинский. За раунд +{XpExtra} опыта."
            ],
            Button = "Играть",
            Seconds = spec.Seconds,
            Pairs = pairs,
            Back = Back(pairs.Concat(oldForms.Where(i => !skip.Contains(i.Key))), check, forms, input.Words, level, spec, random),
            Check = check
        };

        static string What(List<DailyItem> items)
        {
            var verbs = items.Count(i => i.Kind == "verb");
            var words = items.Count - verbs;
            return string.Join(" и ", new[]
            {
                verbs > 0 ? Count(verbs, "форма", "формы", "форм") : null,
                words > 0 ? Count(words, "слово", "слова", "слов") : null
            }.Where(x => x != null));
        }
    }

    /// <summary>
    /// The way back: the meaning in Russian, the Georgian to pick. Today's pairs first, then the warm-up, then weak forms;
    /// the form of the last check is left for the check. The higher the level, the more alike the options.
    /// </summary>
    private static List<DailyBackRound> Back(
        IEnumerable<DailyItem> items, DailyCheck check, IReadOnlyList<DailyForm> forms, IReadOnlyList<DailyWord> words,
        int level, LevelSpec spec, Random random)
    {
        var checkKey = check.Picks.FirstOrDefault(p => p.Ok)?.Item.Key;
        var rounds = new List<DailyBackRound>();
        foreach (var item in items.Where(i => i.Key != checkKey).DistinctBy(i => i.Key))
        {
            if (rounds.Count >= spec.Back)
            {
                break;
            }

            if (rounds.Any(r => r.Item.Ru == item.Ru))
            {
                continue;
            }

            var wrong = Lookalikes(item, forms, words, level, random)
                .Where(o => o.Ka != item.Ka && o.Ru != item.Ru && o.Ka.Length <= 20)
                .DistinctBy(o => o.Ka)
                .Take(spec.Options - 1)
                .ToList();
            if (wrong.Count == 0)
            {
                continue;
            }

            var options = Shuffle(wrong.Select(o => new DailyBackOption(o, false)).Append(new DailyBackOption(item, true)), random);
            rounds.Add(new DailyBackRound(item, options));
        }

        return rounds;
    }

    /// <summary>Options that look like the item: forms of the same verb (the same tense first on a high level), else other words.</summary>
    private static IEnumerable<DailyItem> Lookalikes(
        DailyItem item, IReadOnlyList<DailyForm> forms, IReadOnlyList<DailyWord> words, int level, Random random)
    {
        if (item.Kind == "verb")
        {
            var same = forms.Where(f => f.Lemma == item.Lemma && f.Key != item.Key).ToList();
            var sameTense = Shuffle(same.Where(f => f.Tense == item.Tense), random);
            var otherTense = Shuffle(same.Where(f => f.Tense != item.Tense), random);
            var own = level >= 2 ? sameTense.Concat(otherTense) : otherTense.Concat(sameTense);
            return own.Concat(Shuffle(forms.Where(f => f.Lemma != item.Lemma), random)).Select(Item);
        }

        return Shuffle(words.Where(w => w.Key != item.Key), random).Select(Item);
    }

    /// <summary>
    /// The reminder: one fact about today that is about this learner (the streak, a verb that slips, forms that are
    /// due, a word of their own), as a short headline for the chat list, and one line under it. The facts take turns
    /// day by day so the reminder does not read the same every evening.
    /// </summary>
    private static DailyPush Push(
        DailyInput input, string mode, List<DailyWarmRound> rounds, List<DailyItem> pairs, IReadOnlyList<DailyForm> forms,
        string? staleVerb, Func<DailyForm, bool> slipped)
    {
        var dayNumber = DateOnly.FromDateTime(input.Now).DayNumber;
        const string start = "Начать · 2 минуты";
        if (mode == DailyMode.Comeback)
        {
            return new DailyPush("comeback", "👋 Давно не виделись",
                "Одна минута и только то, что ты знаешь лучше всего. Начни с лёгкого.", "Вспомнить за минуту");
        }

        if (mode == DailyMode.Review)
        {
            return new DailyPush("review", "💪 Закрепим знакомое",
                "Сегодня без нового: только формы, где были ошибки. Две минуты — и они встанут на место.", start);
        }

        var options = new List<DailyPush>();
        var next = input.Streak + 1;
        if (input.PlayedYesterday && !input.PlayedToday && input.Streak >= 1)
        {
            options.Add(new DailyPush("streak", $"🔥 {Count(next, "день", "дня", "дней")} подряд — продли серию",
                $"Две минуты сегодня, и серия станет длиннее. {Capital(Content(pairs, rounds))}.", start));
        }

        var slipItems = forms.Where(slipped).ToList();
        if (slipItems.Count > 0)
        {
            var verb = slipItems.GroupBy(f => f.VerbRu).OrderByDescending(g => g.Count()).First();
            options.Add(new DailyPush("slip", $"🧠 «{verb.Key}» начал забываться",
                $"{Count(verb.Count(), "форма стала", "формы стали", "форм стали")} получаться хуже. Две минуты — и они снова твои.", start));
        }

        var due = rounds.Where(r => r.Due).Select(r => r.Item).ToList();
        if (due.Count > 0)
        {
            var verb = due.GroupBy(i => i.VerbRu).OrderByDescending(g => g.Count()).First();
            options.Add(new DailyPush("due", $"⏰ {Count(verb.Count(), "форму", "формы", "форм")} «{verb.Key}» пора повторить",
                "Повтори их сейчас, и они запомнятся надолго. Две минуты.", start));
        }

        var word = pairs.FirstOrDefault(p => p.Kind == "word" && p.Ka.Length <= 14 && p.Ru.Length <= 20);
        if (word != null)
        {
            var rest = pairs.Count + rounds.Count - 1;
            options.Add(new DailyPush("word", $"📖 {word.Ka} ({Cyr(word.Ka)}) — {word.Ru}",
                $"Слово из твоего словаря. Сегодня повторим его и ещё {Count(rest, "форму", "формы", "форм")} — две минуты.", start));
        }

        if (staleVerb != null)
        {
            var verbRu = forms.First(f => f.Lemma == staleVerb).VerbRu;
            options.Add(new DailyPush("stale", $"🗝 Вернём глагол «{verbRu}»",
                "Три недели без практики. Две минуты — и он снова под рукой.", start));
        }

        if (options.Count == 0)
        {
            options.Add(new DailyPush("mix", "✨ Задание дня готово",
                $"{Capital(Content(pairs, rounds))}. Две минуты.", start));
        }

        return options[dayNumber % options.Count];

        static string Content(List<DailyItem> pairs, List<DailyWarmRound> rounds)
        {
            var verbs = pairs.Concat(rounds.Select(r => r.Item)).Where(i => i.VerbRu != null).Select(i => $"«{i.VerbRu}»").Distinct().Take(2).ToList();
            var words = pairs.Count(p => p.Kind == "word");
            var parts = new List<string>();
            if (verbs.Count > 0)
            {
                parts.Add((verbs.Count == 1 ? "глагол " : "глаголы ") + string.Join(" и ", verbs));
            }

            if (words > 0)
            {
                parts.Add(Count(words, "слово", "слова", "слов") + " из словаря");
            }

            return "в задании " + string.Join(" и ", parts);
        }

        static string Capital(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..];
    }

    /// <summary>The first sentence of an ordinary day: what exactly brought today's forms here.</summary>
    private static string MixReason(
        DailyInput input, List<DailyWarmRound> rounds, List<DailyItem> pairs, IReadOnlyList<DailyForm> forms,
        string? staleVerb, Dictionary<string, DateTime> last, Func<DailyForm, bool> slipped)
    {
        var dueItems = rounds.Where(r => r.Due).Select(r => r.Item).ToList();
        var slippedKeys = forms.Where(slipped).Select(f => f.Key).ToHashSet();
        var slippedItems = pairs.Where(p => slippedKeys.Contains(p.Key)).ToList();

        var text = "";
        if (dueItems.Count > 0)
        {
            text = OfVerb(dueItems, capital: true)
                   + $"{Count(dueItems.Count, "форма ждёт", "формы ждут", "форм ждут")} повторения";
        }

        if (slippedItems.Count > 0)
        {
            var tail = $"{Count(slippedItems.Count, "форма стала", "формы стали", "форм стали")} получаться хуже";
            text = text.Length > 0
                ? $"{text}, а {OfVerb(slippedItems, capital: false)}{tail}"
                : OfVerb(slippedItems, capital: true) + tail;
        }

        text = text.Length > 0 ? text + "." : "Сегодня формы и слова, которые пока держатся слабее всего.";
        if (input.Away > 0)
        {
            text = $"{Count(input.Away, "день", "дня", "дней")} без занятий. {text}";
        }

        if (staleVerb != null)
        {
            var verbRu = forms.First(f => f.Lemma == staleVerb).VerbRu;
            text += $" Глагол «{verbRu}» без практики с {Date(last[staleVerb])} — начни с него.";
        }

        return text;

        // «У глагола «иметь» » when all the forms belong to one verb, nothing otherwise.
        static string OfVerb(List<DailyItem> items, bool capital)
        {
            var verbs = items.Select(i => i.VerbRu).Distinct().ToList();
            return verbs.Count == 1 && verbs[0] != null ? $"{(capital ? "У" : "у")} глагола «{verbs[0]}» " : "";
        }
    }

    private static List<string> Why(
        DailyInput input, string mode, int level, List<DailyForm> due, List<DailyForm> slip, List<string> staleVerbs,
        int fresh, int weak, DailyNew? next)
    {
        var why = new List<string>();
        if (input.Away > 0)
        {
            why.Add($"Без занятий: {Count(input.Away, "день", "дня", "дней")}.");
        }

        if (mode == DailyMode.Review && input.LastErrors > 0)
        {
            why.Add($"Ошибок в прошлой игре: {input.LastErrors}.");
        }

        if (due.Count > 0)
        {
            var verbs = string.Join(", ", due.Select(f => $"«{f.VerbRu}»").Distinct().Take(3));
            why.Add($"Ждут повторения по расписанию: {Count(due.Count, "форма", "формы", "форм")} ({verbs}).");
        }

        if (slip.Count > 0)
        {
            why.Add($"Стали получаться хуже: {Count(slip.Count, "форма", "формы", "форм")}.");
        }

        if (staleVerbs.Count > 0)
        {
            why.Add($"Три недели и дольше без практики: {Count(staleVerbs.Count, "глагол", "глагола", "глаголов")}.");
        }

        if (input.Words.Count > 0)
        {
            why.Add($"В словаре {Count(input.Words.Count, "слово", "слова", "слов")}: новых за неделю — {fresh}, с ошибками — {weak}.");
        }

        why.Add(input.Accuracy == null
            ? "Это первая игра, поэтому уровень средний."
            : $"Точность последних игр: {input.Accuracy}% — уровень {level} из 3.");
        why.Add(mode == DailyMode.Review ? "Нового сегодня нет: сначала закрепляем."
            : next != null ? $"Новое в конце, если игра пройдёт чисто: {next.Title} — {next.Line}."
            : "Нового в конце сегодня нет.");
        return why;
    }

    /// <summary>The last task: one form of today's game among look-alikes.</summary>
    private static DailyCheck Check(
        List<DailyItem> pairs, IReadOnlyList<DailyForm> forms, IReadOnlyList<DailyWord> words, int level, int options,
        Random random)
    {
        var key = pairs.FirstOrDefault(p => p.Kind == "verb" && CheckOk(p)) ?? pairs.FirstOrDefault(CheckOk) ?? pairs[0];
        var isVerb = key.Kind == "verb";

        IEnumerable<DailyItem> pool;
        if (isVerb)
        {
            var same = forms.Where(f => f.Lemma == key.Lemma && f.Key != key.Key).ToList();
            var sameTense = Shuffle(same.Where(f => f.Tense == key.Tense), random);
            var otherTense = Shuffle(same.Where(f => f.Tense != key.Tense), random);
            // The higher the level, the more alike the options.
            var own = level >= 3 ? sameTense.Concat(otherTense)
                : level == 1 ? otherTense.Concat(sameTense)
                : Shuffle(same, random);
            pool = own.Concat(Shuffle(forms.Where(f => f.Lemma != key.Lemma), random)).Select(Item);
        }
        else
        {
            pool = Shuffle(words.Where(w => w.Key != key.Key), random).Select(Item).Where(i => TileOk(i) && CheckOk(i));
        }

        var wrong = new List<DailyItem>();
        foreach (var item in pool)
        {
            if (wrong.Count >= options - 1)
            {
                break;
            }

            if (item.Ka != key.Ka && item.Ru != key.Ru && wrong.All(w => w.Ka != item.Ka && w.Ru != item.Ru))
            {
                wrong.Add(item);
            }
        }

        var other = isVerb ? "другую форму" : "другое слово";
        var picks = wrong
            .Select(w => new DailyPick(w, false, $"«{w.Ka}» ({Cyr(w.Ka)}) — это «{w.Ru}». Нажми {other}."))
            .Append(new DailyPick(key, true, $"Верно: «{key.Ka}» ({Cyr(key.Ka)}) — {key.Ru}."));

        return new DailyCheck(
            isVerb ? $"Нажми форму, которая значит «{key.Ru}»" : $"Нажми слово, которое значит «{key.Ru}»",
            !isVerb ? "Последнее задание: одно слово из сегодняшней игры."
            : level >= 3 ? "Последнее задание. Формы похожи, смотри внимательно."
            : "Последнее задание: одна форма из сегодняшней игры.",
            Shuffle(picks, random));
    }

    /// <summary>
    /// The forms the verb session would open next: of the verb the game was mostly about, else of the
    /// most recently practised one. The session decides which forms; the offer only names them.
    /// </summary>
    private static DailyNew? Portion(IReadOnlyList<DailyUnopened> unopened, Dictionary<string, DateTime> last, string? prefer)
    {
        var verb = unopened.Where(u => u.Next.Count > 0)
            .OrderByDescending(u => u.Lemma == prefer)
            .ThenByDescending(u => last.GetValueOrDefault(u.Lemma))
            .FirstOrDefault();
        if (verb == null)
        {
            return null;
        }

        var meanings = string.Join(", ", verb.Next.Select(f => $"«{f.Ru}»"));
        return new DailyNew(
            DailyNew.Forms,
            $"Новые формы глагола «{verb.VerbRu}»",
            string.Join(" · ", verb.Next.Select(f => f.Ru)),
            $"Игра прошла чисто — можно брать новое. Открой у глагола «{verb.VerbRu}» {Count(verb.Next.Count, "новую форму", "новые формы", "новых форм")}: {meanings}. Это короткая сессия.",
            "Открыть новые формы",
            VerbId: verb.Lemma);
    }

    private static DailyItem Item(DailyForm f) =>
        new(f.Key, "verb", f.Ka, f.Ru, f.Lemma, f.VerbRu, f.Tense, f.Person);

    private static DailyItem Item(DailyWord w) => new(w.Key, "word", w.Ka, w.Ru);

    /// <summary>Fits a tile of the pairs game on a phone.</summary>
    private static bool TileOk(DailyItem item) => item.Ka.Length <= 20 && item.Ru.Length <= 24;

    /// <summary>Short and unambiguous enough to be the answer of the last task.</summary>
    private static bool CheckOk(DailyItem item) =>
        item.Ka.Length <= 12 && (item.Kind == "verb" || item.Ru.IndexOfAny([',', '(', ')', '/', '?']) < 0);

    private static string Cyr(string georgian) => GeorgianTranscriptionExtension.GetTranscription(georgian);

    private static List<T> Shuffle<T>(IEnumerable<T> source, Random random)
    {
        var list = source.ToList();
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }

        return list;
    }

    /// <summary>«1 форма», «3 формы», «5 форм».</summary>
    public static string Count(int n, string one, string few, string many) => $"{n} {Plural(n, one, few, many)}";

    public static string Plural(int n, string one, string few, string many)
    {
        var tens = Math.Abs(n) % 100;
        var units = tens % 10;
        return tens is >= 11 and <= 14 ? many : units == 1 ? one : units is >= 2 and <= 4 ? few : many;
    }

    /// <summary>«повтори 1 форму / 3 формы / 5 форм».</summary>
    private static string Accusative(int n) => Count(n, "форму", "формы", "форм");

    private static readonly string[] Months =
    {
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"
    };

    private static string Date(DateTime date) => $"{date.Day} {Months[date.Month - 1]}";
}
