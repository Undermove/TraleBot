"""Уроки слов модуля «Алфавит».

После каждого урока букв (id 1..11) идут уроки слов: слова этого урока букв (базовый словарь из теории
уроков, words.json → lessons) делятся на уроки по 2–4 слова, каждое слово получает свою сцену «Новое слово».
Новые уроки получают id 12, 13, … по порядку (старые id 1..11 не меняются — прогресс людей сохраняется).

Скрипт дописывает в words.json раздел wordLessons (id, после какого урока букв, слова) и пишет файлы
вопросов questions<id>.json — короткую проверку из 4 вопросов. Вопросы собираются только из слов
базового словаря, их перевода и кириллической транскрипции — никакой новой грузинской лексики.

Запуск из корня репозитория: python3 scripts/alphabet-words/gen_word_lessons.py
"""
import json, os, random

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "Trale", "Lessons", "GeorgianAlphabetProgressive")
CYR = dict(zip("აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ",
               ["а", "б", "г", "д", "э", "в", "з", "т", "и", "к’", "л", "м", "н", "о", "п’", "ж", "р", "с", "т’", "у", "п", "к", "гх", "къ", "ш", "ч", "ц", "дз", "ц’", "ч’", "х", "дж", "х"]))
cyr = lambda w: "".join(CYR.get(c, c) for c in w)

path = os.path.join(ROOT, "words.json")
data = json.load(open(path))
lessons = data["lessons"]


def chunks(words):
    n = len(words)
    if n <= 4:
        return [words]
    a = (n + 1) // 2
    return [words[:a], words[a:]]


word_lessons, next_id = [], 12
for l in lessons:
    for part in chunks(l["words"]):
        word_lessons.append({"id": next_id, "after": l["lesson"], "words": part})
        next_id += 1
data["wordLessons"] = word_lessons
data["aboutWordLessons"] = ("Уроки слов: после каждого урока букв (id 1..11) — уроки по 2–4 слова этого урока букв, "
                            "id 12 и дальше по порядку. Порядок в модуле: урок букв, затем его уроки слов. "
                            "Сгенерировано scripts/alphabet-words/gen_word_lessons.py.")
json.dump(data, open(path, "w"), ensure_ascii=False, indent=2)
open(path, "a").write("\n")

seen = []  # слова, уже известные к этому уроку (для неверных вариантов)
for wl in word_lessons:
    rng = random.Random(wl["id"])
    words = wl["words"]
    pool = seen + words
    def others(key, right, k=2):
        cands = [key(w) for w in pool if key(w) != right]
        cands = list(dict.fromkeys(cands))
        rng.shuffle(cands)
        return cands[:k]
    qs = []
    def add(kind, w):
        n = len(qs) + 1
        if kind == "read":
            right = cyr(w["word"]); opts = [right] + others(lambda x: cyr(x["word"]), right)
            q = dict(lemma=w["word"], question=f"Как читается «{w['word']}»?", tags=["word-reading"])
        elif kind == "meaning":
            right = w["translation"]; opts = [right] + others(lambda x: x["translation"], right)
            q = dict(lemma=w["word"], question=f"Что значит «{w['word']}»?", tags=["word-reading", "meaning"])
        else:
            right = w["word"]; opts = [right] + others(lambda x: x["word"], right)
            q = dict(lemma=w["word"], question=f"Где написано «{w['translation']}»?", tags=["word-recognition"])
        if len(opts) < 2:
            return
        rng.shuffle(opts)
        qs.append(dict(id=f"abw{wl['id']}-q{n:02d}", lemma=q["lemma"], question=q["question"], options=opts,
                       answer_index=opts.index(right), explanation=f"«{w['word']}» — «{cyr(w['word'])}», {w['translation']}.",
                       tags=q["tags"], difficulty=1))
    plan = ["read", "meaning", "recognition", "meaning"]
    for i, kind in enumerate(plan):
        add(kind, words[i % len(words)])
    letters = wl["after"]
    title = "Слова: " + ", ".join(w["word"] for w in words)
    out = dict(lesson_id=f"alpha-w{wl['id']}", title=title, ordered=True, lexicon=[w["word"] for w in words], questions=qs)
    json.dump(out, open(os.path.join(ROOT, f"questions{wl['id']}.json"), "w"), ensure_ascii=False, indent=2)
    open(os.path.join(ROOT, f"questions{wl['id']}.json"), "a").write("\n")
    seen += words
print(len(word_lessons), "word lessons:", [(w["id"], w["after"], len(w["words"])) for w in word_lessons])
