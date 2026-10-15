#!/usr/bin/env python3
"""
Модуль «Знакомство»: собирает из src/Trale/miniapp-src/src/intro/story.json
  - теорию уроков 2..N в MiniAppContentProvider.cs (BuildIntroModule; урок 1 остаётся как был),
  - вопросы проверки Lessons/GeorgianVocabIntro/questions{N}.json для уроков 2..N (questions.json урока 1 не трогаем).

Запуск из корня репозитория: python3 tools/intro_story.py
Скрипт детерминированный (свой генератор случайных чисел), повторный запуск даёт те же файлы.
Весь грузинский — из story.json, у каждой фразы там источник.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORY = ROOT / "src/Trale/miniapp-src/src/intro/story.json"
PROVIDER = ROOT / "src/Trale/MiniApp/MiniAppContentProvider.cs"
LESSONS_DIR = ROOT / "src/Trale/Lessons/GeorgianVocabIntro"
REGISTRY = ROOT / "src/Trale/MiniApp/ModuleRegistry.cs"

story = json.loads(STORY.read_text(encoding="utf-8"))
P = story["phrases"]
L = story["lessons"]
V = story["vocab"]


class Rng:
    """Линейный конгруэнтный генератор: одинаковые файлы при каждом запуске."""

    def __init__(self, seed):
        self.s = seed

    def __call__(self):
        self.s = (self.s * 1103515245 + 12345) % (2 ** 31)
        return self.s / 2 ** 31

    def shuffle(self, a):
        a = list(a)
        for i in range(len(a) - 1, 0, -1):
            j = int(self() * (i + 1))
            a[i], a[j] = a[j], a[i]
        return a


def known(lesson_id):
    return [pid for l in L if l["id"] <= lesson_id for pid in l["new"]]


def clean(geo):
    return geo.replace("…", "").strip()


# ── Правила: абзац теории (то же, что «находка правила» в уроке) ─────────────────────────────────────
RULES = {
    "time": "დილა — утро, საღამო — вечер. Вторая половина მშვიდობისა одна и та же. А გამარჯობა годится в любое время суток.",
    "echo": "შენ — «ты». კარგად, შენ? — «хорошо, а ты?»: так вежливо ответить и сразу спросить в ответ.",
    "name": "Иностранное имя на согласную грузины договаривают гласной ი: Карлос → კარლოსი. Имя на гласную остаётся как есть: ნინო.",
    "from": "-დან — «из». Прилипает к концу слова, слово остаётся целым: ესპანეთი → ესპანეთიდან, საქართველო → საქართველოდან.",
    "in": "-ში — «в». Если слово кончается на ი, она уходит: ბათუმი → ბათუმში, თბილისი → თბილისში.",
    "da": "და — это и «сестра», и «и». Какое из двух, понятно по месту: между словами — «и», после «одна» — сестра.",
    "have": "В грузинском «у меня есть» — два разных глагола. მყავს — о людях и животных (от ყოლა), მაქვს — о вещах (от ქონა).",
}

GAME_NOTE = {
    "yard": "Игра «Дворик»: соседи выходят и приходят, поздоровайся по времени суток.",
    "elevator": "Игра «Лифт»: успей поговорить с соседом, пока лифт не доехал до его этажа.",
    "party": "Игра «Вечеринка»: гости знакомятся, а ты запоминаешь, кто есть кто.",
    "magnets": "Игра «Магниты»: прилепи к слову нужное окончание, пока лента не увезла его.",
    "border": "Игра «Паспортный контроль»: сверь, что говорит путешественник, с его паспортом.",
    "detective": "Игра «Кто есть кто»: по подслушанным репликам разберись, кто откуда.",
    "chat": "Переписка с соседкой Нино: выбирай реплики, чтобы разговор был тёплым.",
    "taxi": "Игра «Такси»: таксист болтает всю дорогу, отвечай, пока едешь.",
    "family": "Семейный альбом Нино: разложи фотографии по местам на семейном древе.",
    "havesort": "Игра «Живое или вещь»: отправь каждое слово в корзину მყავს или მაქვს.",
    "aboutme": "Собери рассказ о себе: имя, откуда ты, где живёшь, кем работаешь и что любишь.",
    "supra": "Супра у соседей: с каждым гостем свой разговор, а между ними — тосты.",
}


def cs(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def theory_blocks(lesson):
    blocks = []
    new = [P[pid] for pid in lesson["new"]]
    if new:
        blocks.append("List(" + ", ".join(cs(f'{clean(p["geo"])} — {p["ru"]}') for p in new) + ")")
        for p in new:
            if p.get("words") and len(p["words"]) > 1:
                parts = ", ".join(f"{g} — {r}" for g, r in p["words"])
                blocks.append(f'Example({cs(clean(p["geo"]))}, {cs(p["ru"][:1].upper() + p["ru"][1:] + " (" + parts + ")")})')
    for s in lesson["steps"]:
        if s["kind"] == "rule":
            blocks.append(f'Paragraph({cs(RULES[s["rule"]])})')
    if lesson["id"] == 8:
        blocks.append("List(" + ", ".join(cs(f"{g} — {r}") for g, r in V["names"].items() if not g.startswith("_")) + ")")
    if lesson["id"] == 14:
        blocks.append("List(" + ", ".join(cs(f'{c["base"]} → {c["from"]} — {c["ruFrom"]}') for c in V["countries"]) + ")")
    if lesson["id"] == 18:
        blocks.append("List(" + ", ".join(cs(f'{c["base"]} → {c["in"]} — в {c["ru"]}') for c in V["cities"]) + ")")
    if lesson["id"] in (20, 21):
        blocks.append("List(" + ", ".join(cs(f'{j["geo"]} — {j["ru"]}') for j in V["jobs"]) + ")")
    if lesson["id"] in (27, 28):
        side = "alive" if lesson["id"] == 27 else "things"
        title = "მყავს — о живых: " if side == "alive" else "მაქვს — о вещах: "
        blocks.append(f'Paragraph({cs(title + ", ".join(w["geo"] + " (" + w["ru"] + ")" for w in V[side]))})')
    games = [GAME_NOTE[s["kind"]] for s in lesson["steps"] if s["kind"] in GAME_NOTE]
    if games:
        blocks.append(f'Paragraph({cs(" ".join(dict.fromkeys(games)))})')
    if not new:
        # Повторение: что из уже знакомого урок тренирует.
        pool = review_pool(lesson)
        blocks.append("List(" + ", ".join(cs(f'{clean(P[pid]["geo"])} — {P[pid]["ru"]}') for pid in pool[:8]) + ")")
    return blocks


def review_pool(lesson):
    """Фразы, на которых стоит урок без новых фраз: фразы своего акта, потом всё известное."""
    act_ids = [pid for l in L if l["act"] == lesson["act"] and l["id"] <= lesson["id"] for pid in l["new"]]
    rest = [pid for pid in known(lesson["id"]) if pid not in act_ids]
    return list(dict.fromkeys(act_ids + rest[::-1]))


def lesson_cs(lesson):
    blocks = theory_blocks(lesson)
    short = ", ".join(clean(P[pid]["geo"]) for pid in lesson["new"][:3]) or "повторение"
    body = ",\n".join("                        " + b for b in blocks)
    return (
        f'                Lesson({lesson["id"]}, {cs(lesson["title"])}, {cs(short)},\n'
        f'                    {cs(lesson["title"])},\n'
        f'                    {cs(lesson["goal"])},\n'
        f'                    new List<TheoryBlockDto>\n'
        f'                    {{\n{body}\n'
        f'                    }})'
    )


# ── Вопросы проверки ──────────────────────────────────────────────────────────────────────────────

def questions(lesson):
    rng = Rng(lesson["id"] * 7919)
    k = known(lesson["id"])
    targets = lesson["new"] or review_pool(lesson)[:4]
    others = [pid for pid in k]
    qs = []

    def distract(pid, field, n=2):
        pool = [o for o in others if o != pid and P[o][field] != P[pid][field] and clean(P[o]["geo"]) != clean(P[pid]["geo"])]
        return rng.shuffle(pool)[:n]

    def add(q):
        q["id"] = f'intro{lesson["id"]}-q{len(qs) + 1}'
        qs.append(q)

    def mcq(lemma, question, right, wrong, explanation, tag):
        opts = rng.shuffle([right] + wrong)
        add({"lemma": lemma, "question": question, "options": opts, "answer_index": opts.index(right),
             "explanation": explanation, "tags": [tag], "difficulty": 1})

    for pid in targets:
        p = P[pid]
        geo = clean(p["geo"])
        ds = distract(pid, "ru")
        if len(ds) >= 2:
            mcq(geo, f"Как переводится «{geo}»?", p["ru"], [P[d]["ru"] for d in ds], f"«{geo}» — {p['ru']}.", "meaning")
        ds = distract(pid, "geo")
        if len(ds) >= 2:
            mcq(geo, f"Как сказать «{p['ru']}»?", geo, [clean(P[d]["geo"]) for d in ds], f"«{p['ru']}» — «{geo}».", "reverse")

    # Вопросы на правило и словарик урока.
    lid = lesson["id"]
    if lid == 8:
        mcq("კარლოსი", "Как грузины скажут имя «Карлос»?", "კარლოსი", ["კარლოს", "კარლოსო"], "Имя на согласную договаривают гласной ი: კარლოსი.", "rule")
        mcq("ნინო", "Нужна ли ი в конце имени «Нино»?", "нет: имя кончается на гласную", ["да, как у всех имён", "да, если это женское имя"], "Имя на гласную остаётся как есть: ნინო.", "rule")
    if lid in (14, 15, 24):
        for c in rng.shuffle(V["countries"])[:2]:
            mcq(c["from"], f"Как сказать «{c['ruFrom']}»?", c["from"], [c["base"], rng.shuffle([o["from"] for o in V["countries"] if o is not c])[0]], f"-დან — «из»: {c['base']} → {c['from']}.", "rule")
    if lid in (18, 19, 24):
        for c in rng.shuffle(V["cities"])[:2]:
            mcq(c["in"], f"Как сказать «в {c['ru']}»?", c["in"], [c["base"], rng.shuffle([o["in"] for o in V["cities"] if o is not c])[0]], f"-ში — «в», последняя ი уходит: {c['base']} → {c['in']}.", "rule")
    if lid in (20, 21):
        for j in V["jobs"]:
            others_j = [o["ru"] for o in V["jobs"] if o is not j]
            mcq(j["geo"], f"Как переводится «{j['geo']}»?", j["ru"], others_j, f"«{j['geo']}» — {j['ru']}.", "meaning")
    if lid in (27, 28, 30):
        for w in rng.shuffle(V["alive"])[:2] + rng.shuffle(V["things"])[:2]:
            alive = w in V["alive"]
            right = f"მე {'მყავს' if alive else 'მაქვს'} {w['geo']}"
            wrong = f"მე {'მაქვს' if alive else 'მყავს'} {w['geo']}"
            lemma = "მყავს" if alive else "მაქვს"
            mcq(lemma, f"Как сказать «у меня есть {w['ru']}»?", right, [wrong, f"მე ვარ {w['geo']}"],
                f"{w['geo']} — {'живое: მყავს' if alive else 'вещь: მაქვს'}.", "rule")
    if lid == 26:
        mcq("და", "Что значит первое «და» во фразе «ერთი ძმა და ერთი და»?", "и", ["сестра", "брат"], "Между словами და — «и», а после «одна» — сестра.", "rule")
    # Ситуации — чтобы проверка была не только переводом.
    situations = {
        1: [("ნახვამდის", "Сосед уходит на работу. Что ему сказать?", "nakhvamdis", ["gamarjoba"])],
        2: [("დილა მშვიდობისა", "Восемь утра, ты выходишь из подъезда. Как поздороваться с соседкой?", "dila", ["saghamo", "nakhvamdis"]),
            ("საღამო მშვიდობისა", "Вечер, сосед возвращается с работы. Как поздороваться?", "saghamo", ["dila", "nakhvamdis"])],
        3: [("კარგად, მადლობა", "Сосед спросил «როგორ ხარ?». Что ответить?", "kargad_madloba", ["gamarjoba", "nakhvamdis"])],
        4: [("კარგად, შენ?", "Сосед спросил «როგორ ხარ?». Как ответить и спросить в ответ?", "kargad_shen", ["rogor", "nakhvamdis"])],
        5: [("ბოდიში", "В тесном лифте ты наступил соседу на ногу. Что сказать?", "bodishi", ["madloba", "ki"]),
            ("მადლობა", "Соседка придержала тебе дверь. Что сказать?", "madloba", ["bodishi", "ara"])],
        6: [("გაგიმარჯოს", "Сосед первым сказал тебе «გამარჯობა!». Как ответить?", "gagimarjos", ["nakhvamdis", "bodishi"])],
        9: [("რა გქვია?", "Ты хочешь узнать имя человека. Что спросить?", "ra_gkvia", ["rogor", "nakhvamdis"])],
        10: [("სასიამოვნოა", "Вы только что познакомились. Что сказать?", "sasiamovnoa", ["nakhvamdis", "bodishi"])],
        13: [("საიდან ხარ?", "Ты хочешь узнать, откуда человек. Что спросить?", "saidan", ["ra_gkvia", "rogor"])],
        31: [("არ ვიცი", "Нино спросила то, чего ты не знаешь. Что ответить?", "ar_vici", ["ki", "madloba"])],
        33: [("გაუმარჯოს!", "Тамада поднял тост. Что сказать?", "gaumarjos", ["nakhvamdis", "bodishi"])],
    }
    for lemma, q, right, wrong in situations.get(lid, []):
        w = [clean(P[x]["geo"]) for x in wrong if x in k]
        if len(w) < 2:
            w += [clean(P[x]["geo"]) for x in rng.shuffle([o for o in k if o != right and clean(P[o]["geo"]) not in w])][: 2 - len(w)]
        mcq(clean(P[right]["geo"]), q, clean(P[right]["geo"]), w[:2], f"«{clean(P[right]['geo'])}» — {P[right]['ru']}.", "context")
    # Мало вопросов (урок с одной-двумя фразами) — добираем переводом уже знакомых фраз.
    for pid in review_pool(lesson):
        if len(qs) >= 6:
            break
        if pid in targets:
            continue
        p = P[pid]
        geo = clean(p["geo"])
        ds = distract(pid, "ru")
        if len(ds) >= 2:
            mcq(geo, f"Как переводится «{geo}»?", p["ru"], [P[d]["ru"] for d in ds], f"«{geo}» — {p['ru']}.", "meaning")
    # Проверка — последние вопросы: пусть там будут правило и ситуации, а перевод — раньше.
    qs.sort(key=lambda q: {"meaning": 0, "reverse": 1, "rule": 2, "context": 3}[q["tags"][0]])
    for i, q in enumerate(qs):
        q["id"] = f'intro{lid}-q{i + 1}'
    return qs


def write_questions():
    for lesson in L:
        if lesson["id"] == 1:
            continue
        qs = questions(lesson)
        assert len(qs) >= 5, (lesson["id"], len(qs))
        lexicon = list(dict.fromkeys(q["lemma"] for q in qs))
        out = {"lesson_id": f'intro-{lesson["id"]}', "title": lesson["title"], "lexicon": lexicon, "questions": qs}
        (LESSONS_DIR / f'questions{lesson["id"]}.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_theory():
    src = PROVIDER.read_text(encoding="utf-8")
    start = src.index("    private static ModuleDto BuildIntroModule()")
    end = src.index("    private static ModuleDto BuildEmergencyModule()")
    old = src[start:end]
    l1_start = old.index('                Lesson(1, "Приветствия"')
    l1_end = old.index("                Lesson(2, ")
    lesson1 = old[l1_start:l1_end].rstrip().rstrip(",")
    lessons = [lesson1] + [lesson_cs(l) for l in L if l["id"] != 1]
    new = (
        "    private static ModuleDto BuildIntroModule()\n"
        "    {\n"
        "        // «Знакомство» — история в шести актах. Уроки 2+ собираются из\n"
        "        // src/Trale/miniapp-src/src/intro/story.json скриптом tools/intro_story.py — правьте story.json.\n"
        "        return new ModuleDto\n"
        "        {\n"
        '            Id = "intro",\n'
        '            Title = "Знакомство",\n'
        '            Emoji = "🤝",\n'
        '            Description = "გამარჯობა, მე მქვია, საიდან ხარ",\n'
        "            Lessons = new List<LessonDto>\n"
        "            {\n"
        + ",\n".join(lessons) + "\n"
        "            }\n"
        "        };\n"
        "    }\n\n"
    )
    PROVIDER.write_text(src[:start] + new + src[end:], encoding="utf-8")


def write_registry():
    src = REGISTRY.read_text(encoding="utf-8")
    src = re.sub(r'(\["intro"\] = new\("intro", "Lessons/GeorgianVocabIntro", )\d+\)', rf"\g<1>{len(L)})", src)
    REGISTRY.write_text(src, encoding="utf-8")


if __name__ == "__main__":
    write_questions()
    write_theory()
    write_registry()
    print(f"intro: {len(L)} lessons")
