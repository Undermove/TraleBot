#!/usr/bin/env python3
"""
Модуль «Знакомство»: собирает из src/Trale/miniapp-src/src/intro/story.json
  - теорию всех уроков в MiniAppContentProvider.cs (BuildIntroModule),
  - вопросы проверки Lessons/GeorgianVocabIntro/questions.json (урок 1) и questions{N}.json (уроки 2..N).

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
    "pingpong": "Игра «Пинг-понг»: разговор — розыгрыш; верни вопрос «а ты?», и мяч летит обратно.",
    "bakery": "Игра «Пекарня»: зашёл за шоти — поздоровайся, поговори о делах, попрощайся.",
    "walk": "Игра «Прогулка»: идёшь по улице, навстречу знакомые — поздоровайся и попрощайся.",
    "elevator": "Игра «Лифт»: успей поговорить с соседом, пока лифт не доехал до его этажа.",
    "party": "Игра «Вечеринка»: гости знакомятся, а ты запоминаешь, кто есть кто.",
    "magnets": "Игра «Наклейки»: прилепи нужное окончание к слову — на бирку чемодана, открытку или бейдж.",
    "reception": "Игра «Ресепшн»: гости гестхауса представляются — найди бронь и выдай ключ.",
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
# Только то, что урок показал: перевод, «как сказать», «послушай и выбери» (запись фразы), ситуация
# и применение правила урока. Никаких корней, этимологии и «буквально означает». Ловушки — только
# из уже знакомых фраз (или неверная форма того же слова, когда проверяется правило).

AUDIO_DIR = ROOT / "src/Trale/miniapp-src/public/audio/intro-story"

# Ситуации: (вопрос, верная фраза, ловушки). Ловушки берутся, только если человек их уже знает.
SITUATIONS = {
    1: [("Сосед выходит из подъезда на работу. Что ему сказать?", "nakhvamdis", ["gamarjoba"]),
        ("Соседка вернулась домой и идёт мимо тебя. Как поздороваться?", "gamarjoba", ["nakhvamdis"])],
    2: [("Восемь утра, ты выходишь из подъезда. Как поздороваться с соседкой?", "dila", ["saghamo", "nakhvamdis"]),
        ("Вечер, сосед возвращается с работы. Как поздороваться?", "saghamo", ["dila", "nakhvamdis"])],
    3: [("Сосед спросил «როგორ ხარ?». Что ответить?", "kargad_madloba", ["gamarjoba", "nakhvamdis"]),
        ("Ты уходишь от соседа. Что сказать на прощание?", "nakhvamdis", ["gamarjoba", "rogor"], "intro3-leave")],
    4: [("Сосед спросил «როგორ ხარ?». Как ответить и спросить в ответ?", "kargad_shen", ["rogor", "nakhvamdis"])],
    5: [("В тесном лифте ты наступил соседу на ногу. Что сказать?", "bodishi", ["madloba", "ki"]),
        ("Соседка придержала тебе дверь. Что сказать?", "madloba", ["bodishi", "ara"]),
        ("Сосед спрашивает, нажать ли тебе кнопку. Тебе нужно. Что ответить?", "ki", ["ara", "bodishi"])],
    6: [("Сосед первым сказал тебе «გამარჯობა!». Как ответить?", "gagimarjos", ["nakhvamdis", "bodishi"])],
    7: [("Тебя спросили, как тебя зовут. Как начать ответ?", "me_mkvia", ["nakhvamdis", "rogor"])],
    9: [("Ты хочешь узнать имя человека. Что спросить?", "ra_gkvia", ["rogor", "nakhvamdis"])],
    10: [("Вы только что познакомились. Что сказать?", "sasiamovnoa", ["nakhvamdis", "bodishi"])],
    11: [("Нино показывает на человека на фото. Как спросить, кто это?", "vin_aris", ["ra_gkvia", "rogor"]),
         ("Ты знакомишь Нино со своим другом. Что сказать?", "es_chemi_megobaria", ["vin_aris", "sasiamovnoa"])],
    13: [("Ты хочешь узнать, откуда человек. Что спросить?", "saidan", ["ra_gkvia", "rogor"])],
    17: [("Нино спрашивает, нравится ли тебе Грузия. Ответь «да».", "ki", ["ara", "bodishi"])],
    21: [("Ты хочешь узнать, кем работает человек. Что спросить?", "ra_profesia", ["saidan", "ra_gkvia"])],
    31: [("Нино спросила то, чего ты не знаешь. Что ответить?", "ar_vici", ["ki", "madloba"]),
         ("Скажи Нино, что ты любишь Грузию.", "miyvars_sakartvelo", ["lamazia", "mogcons"])],
    33: [("Тамада поднял тост. Что сказать?", "gaumarjos", ["nakhvamdis", "bodishi"]),
         ("Тост за Грузию. Что сказать?", "gaumarjos_sakartvelos", ["gaumarjos", "miyvars_sakartvelo"])],
}


# Уроки без новых фраз проверяют то, что в них играли.
REVIEW = {
    8: ["me_mkvia", "me_mkvia_karlosi"],
    12: ["me_mkvia_nino", "ra_gkvia", "sasiamovnoa", "vin_aris"],
    15: ["saidan", "espanetidan", "sakartvelodan", "ra_gkvia"],
    16: ["saidan", "espanetidan", "sakartvelodan", "safrangetidan"],
    24: ["tbilisshi", "batumshi", "studenti", "saidan"],
    30: ["myavs_dzma_da", "myavs_da", "makvs_manqana", "deda", "mama"],
    32: ["me_mkvia", "sakartvelodan", "batumshi", "studenti", "miyvars_sakartvelo"],
}
MAX_LISTEN = 2


def questions(lesson):
    rng = Rng(lesson["id"] * 7919)
    lid = lesson["id"]
    k = known(lid)
    targets = lesson["new"] or REVIEW.get(lesson["id"]) or review_pool(lesson)[:4]
    qs = []
    # В первом уроке знакомы всего две фразы — там вопросы на два варианта.
    need = 2 if len(k) >= 3 else 1

    def distract(pid, field, n=2):
        pool = [o for o in k if o != pid and P[o][field] != P[pid][field] and clean(P[o]["geo"]) != clean(P[pid]["geo"])]
        return rng.shuffle(pool)[:n]

    def mcq(lemma, question, right, wrong, explanation, tag, extra=None, qid=None):
        if tag != "audio" and any(q["question"] == question for q in qs):
            return
        if tag == "audio" and sum(1 for q in qs if q["tags"][0] == "audio") >= MAX_LISTEN:
            return
        opts = rng.shuffle([right] + wrong)
        q = {"lemma": lemma, "question": question, "options": opts, "answer_index": opts.index(right),
             "explanation": explanation, "tags": [tag], "difficulty": 1}
        if extra:
            q.update(extra)
        if qid:
            q["_id"] = qid
        qs.append(q)

    def meaning(pid):
        p = P[pid]; geo = clean(p["geo"]); ds = distract(pid, "ru")
        if len(ds) >= need:
            mcq(geo, f"Как переводится «{geo}»?", p["ru"], [P[d]["ru"] for d in ds], f"«{geo}» — {p['ru']}.", "meaning")

    def reverse(pid):
        p = P[pid]; geo = clean(p["geo"]); ds = distract(pid, "geo")
        if len(ds) >= need:
            mcq(geo, f"Как сказать «{p['ru']}»?", geo, [clean(P[d]["geo"]) for d in ds], f"«{p['ru']}» — «{geo}».", "reverse")

    def listen(pid):
        p = P[pid]; geo = clean(p["geo"]); ds = distract(pid, "geo")
        if len(ds) >= need and (AUDIO_DIR / f"{pid}.m4a").exists():
            mcq(geo, "Послушай и выбери, что сказали", geo, [clean(P[d]["geo"]) for d in ds], f"«{geo}» — {p['ru']}.", "audio",
                {"question_type": "audio-choice", "audio_url": f"/audio/intro-story/{pid}.m4a", "transcript": geo})

    for pid in targets:
        meaning(pid); reverse(pid); listen(pid)

    # Правило урока — на применение, а не на теорию.
    if lid == 8:
        mcq("კარლოსი", "Как Карлос скажет по-грузински «меня зовут Карлос»?", "მე მქვია კარლოსი", ["მე მქვია კარლოს", "ნახვამდის, კარლოს"], "Имя на согласную договаривают гласной ი: კარლოსი.", "rule")
        mcq("ნინო", "Как Нино скажет «меня зовут Нино»?", "მე მქვია ნინო", ["მე მქვია ნინოი", "ნახვამდის, ნინო"], "Имя на гласную остаётся как есть: ნინო.", "rule")
    if lid in (14, 15, 24):
        for c in rng.shuffle(V["countries"])[:2]:
            mcq(c["from"], f"Как сказать «{c['ruFrom']}»?", c["from"], [c["base"], rng.shuffle([o["from"] for o in V["countries"] if o is not c])[0]], f"-დან — «из»: {c['base']} → {c['from']}.", "rule")
    if lid in (18, 19, 24):
        for c in rng.shuffle(V["cities"])[:2]:
            mcq(c["in"], f"Как сказать «в {c['ru']}»?", c["in"], [c["base"], rng.shuffle([o["in"] for o in V["cities"] if o is not c])[0]], f"-ში — «в», последняя ი уходит: {c['base']} → {c['in']}.", "rule")
    if lid in (20, 21):
        for j in V["jobs"]:
            mcq(j["geo"], f"Как переводится «{j['geo']}»?", j["ru"], [o["ru"] for o in V["jobs"] if o is not j], f"«{j['geo']}» — {j['ru']}.", "meaning")
    if lid in (27, 28, 30):
        for w in rng.shuffle(V["alive"])[:2] + rng.shuffle(V["things"])[:2]:
            alive = w in V["alive"]
            right = f"მე {'მყავს' if alive else 'მაქვს'} {w['geo']}"
            wrong = f"მე {'მაქვს' if alive else 'მყავს'} {w['geo']}"
            mcq("მყავს" if alive else "მაქვს", f"Как сказать «у меня есть {w['ru']}»?", right, [wrong],
                f"{w['geo']} — {'живое: მყავს' if alive else 'вещь: მაქვს'}.", "rule")
    if lid == 26:
        mcq("და", "Как сказать «у меня есть сестра»?", "მე მყავს და", ["მე მყავს ძმა", "მე მაქვს მანქანა"], "და — сестра; о живых — მყავს.", "rule")

    for item in SITUATIONS.get(lid, []):
        q, right, wrong = item[0], item[1], item[2]
        qid = item[3] if len(item) > 3 else None
        w = [clean(P[x]["geo"]) for x in wrong if x in k]
        if len(w) < 2:
            w += [clean(P[x]["geo"]) for x in rng.shuffle([o for o in k if o != right and clean(P[o]["geo"]) not in w and clean(P[o]["geo"]) != clean(P[right]["geo"])])][: 2 - len(w)]
        if len(w) < need:
            continue
        mcq(clean(P[right]["geo"]), q, clean(P[right]["geo"]), w[:2], f"«{clean(P[right]['geo'])}» — {P[right]['ru']}.", "context", qid=qid)

    # Урок с одной фразой: добираем «послушай» и перевод фраз своего акта.
    for pid in review_pool(lesson):
        if len(qs) >= 6:
            break
        if pid not in targets:
            listen(pid) if len(qs) % 2 == 0 else meaning(pid)

    # Проверка — последние вопросы: там ситуации, правило и «послушай»; перевод — раньше.
    qs.sort(key=lambda q: {"meaning": 0, "reverse": 1, "audio": 2, "rule": 3, "context": 4}[q["tags"][0]])
    for i, q in enumerate(qs):
        fixed = q.pop("_id", None)
        q["id"] = fixed or f"intro{lid}-q{i + 1}"
    return qs


def write_questions():
    for lesson in L:
        qs = questions(lesson)
        assert len(qs) >= 5, (lesson["id"], len(qs))
        lexicon = list(dict.fromkeys(q["lemma"] for q in qs))
        out = {"lesson_id": f'intro-{lesson["id"]}', "title": lesson["title"], "lexicon": lexicon, "questions": qs}
        (LESSONS_DIR / ("questions.json" if lesson["id"] == 1 else f'questions{lesson["id"]}.json')).write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_theory():
    src = PROVIDER.read_text(encoding="utf-8")
    start = src.index("    private static ModuleDto BuildIntroModule()")
    end = src.index("    private static ModuleDto BuildEmergencyModule()")
    old = src[start:end]
    lessons = [lesson_cs(l) for l in L]
    new = (
        "    private static ModuleDto BuildIntroModule()\n"
        "    {\n"
        "        // «Знакомство» — история в шести актах. Все уроки собираются из\n"
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
