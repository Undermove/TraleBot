#!/usr/bin/env python3
"""Оценка конвейера перевода на настоящей модели: фиксированный набор запросов с ожидаемым исходом.

Скрипт ничего не знает о ключах: он ходит в уже запущенный локальный бэкенд (агент перевода включён,
модели заданы при запуске сервера) и читает из его лога строку «Translation of …: path …» — путь,
число обращений к моделям и токены каждого запроса.

    python3 scripts/dev/eval-translation.py --log <файл лога сервера> \
        [--port 1421] [--container tralebot-ai-db] [--classifier gpt-6-luna] [--analyst gpt-6-luna] [--only группа,…]

Что делает:
  1. чистит то, что накопили прошлые прогоны (кэш переводов, глаголы не из каталога, словари двух
     тестовых пользователей) — каждый прогон начинается с одного и того же состояния;
  2. первый проход — все запросы от пользователя A: путь, обращения к моделям, секунды, вердикт;
  3. второй проход — те же запросы от пользователя B: обращений к моделям должно быть ноль;
  4. итог: сколько прошло, p50/p95 времени запросов, дошедших до модели, цена 1000 новых запросов.

Грузинские слова в наборе не набраны руками: они берутся из каталога (src/Trale/Verbs/verbs.json),
лексикона (lexicon.json), выгрузки парадигм (scripts/verbs/verbs.raw.json), предложений Tatoeba
(sentences.raw.json) и стартовой колоды (QuizCreator.cs) — по русскому переводу или английскому толкованию.
"""
import argparse, hashlib, hmac, json, os, re, statistics, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TOKEN = "local-dev-token"  # выдуманный токен бота, с которым запускается локальный бэкенд
USERS = [("a1a1a1a1-0000-0000-0000-000000000001", "a1a1a1a1-0000-0000-0000-0000000000a1", 990001),
         ("a1a1a1a1-0000-0000-0000-000000000002", "a1a1a1a1-0000-0000-0000-0000000000a2", 990002)]
# $ за 1 млн токенов (вход, выход) — страница цен OpenAI на 06.10.2026.
PRICES = {"gpt-6-luna": (0.10, 0.50), "gpt-5.6-luna": (0.20, 1.20), "gpt-5.4-nano": (0.20, 1.25),
          "gpt-5.4-mini": (0.75, 4.50), "gpt-5.6-terra": (2, 12), "gpt-6-sol": (2, 10), "gpt-6.1-sol": (2, 10),
          "gpt-5.6-sol": (4, 20), "gpt-6-astra": (10, 50)}

ap = argparse.ArgumentParser()
ap.add_argument("--port", default="1421")
ap.add_argument("--container", default="tralebot-ai-db")
ap.add_argument("--log", required=True)
ap.add_argument("--classifier", default="gpt-6-luna")
ap.add_argument("--analyst", default="gpt-6-luna")
ap.add_argument("--only", default="")
ap.add_argument("--json", default="")
args = ap.parse_args()


def load(path):
    return json.load(open(os.path.join(ROOT, path), encoding="utf8"))


CATALOG = load("src/Trale/Verbs/verbs.json")["verbs"]
LEXICON = {r[0]: r for r in load("src/Trale/Verbs/lexicon.json")["verbs"]}
RAW = load("scripts/verbs/verbs.raw.json")["verbs"]
SKIPPED = load("scripts/verbs/verbs.skip.json")
SENTENCES = load("scripts/verbs/sentences.raw.json")
STARTER = dict((ru, ka) for ka, ru in re.findall(r'\("([ა-ჰ]+)", "([а-яё ]+)"\)',
               open(os.path.join(ROOT, "src/Application/Quizzes/Services/QuizCreator.cs"), encoding="utf8").read()))
IN_CATALOG = {v["lemma"] for v in CATALOG}


def cat(ru):
    return next(v for v in CATALOG if v["ru"] == ru)


def form(ru, tense, person):
    return cat(ru)["tenses"][tense][person][0]


def meaning(ru, tense, person):
    return cat(ru)["meanings"][tense][person]


def lex(en):
    """Глагол лексикона по английскому толкованию (точному)."""
    return next(r for r in LEXICON.values() if en in r[3])


def outside(n):
    """n-й глагол с таблицей в выгрузке, которого нет в каталоге (и который не вычеркнут)."""
    rest = [v for v in RAW if v["lemma"] not in IN_CATALOG and v["lemma"] not in SKIPPED
            and all(len(v["tenses"].get(t, [])) == 6 and all(v["tenses"][t]) for t in ("present", "future", "aorist"))]
    return rest[n]


def typo(word, how):
    middle = len(word) // 2
    return word[:middle] + word[middle + 1:] if how == "drop" else word[:middle] + word[middle] + word[middle:]


def jumble(word):
    """Грузинская бессмыслица: буквы настоящего слова в алфавитном порядке, дважды."""
    return "".join(sorted(word)) * 2


TALK = cat("говорить, разговаривать")
OUT = [outside(0), outside(1)]
WORK, SAY, GIVE, HELP, LEARN = lex("to work"), lex("to say"), lex("to give"), lex("to help"), lex("to learn, study")
RAW_LEMMAS = {v["lemma"] for v in RAW}
# Глагол, который лексикон называет сам: есть таблица, есть русский перевод из Викисловаря, в каталоге его нет.
BY_LEXICON = next((r for r in LEXICON.values() if r[2] and r[4] and r[0] in RAW_LEMMAS and r[0] not in IN_CATALOG and r[0] not in SKIPPED), None)
SENTENCE = next(s for s in SENTENCES if len(s["ka"].split()) >= 4)


def lemmas(en):
    """Леммы всех глаголов лексикона с таким английским толкованием."""
    return {r[0] for r in LEXICON.values() if en in r[3]}


# (группа, текст, ожидание). Ожидание: status, path (регулярное выражение), calls (не больше),
# definition (точное значение или множество допустимых), not_definition, info (подстрока доп. сведений).
CASES = [
    # ── форма глагола из каталога: из базы, без модели ──
    ("catalog-form", form("писать", "aorist", 3), dict(path=r"^verb-base$", calls=0, definition=meaning("писать", "aorist", 3))),
    ("catalog-form", form("хотеть", "present", 0), dict(path=r"^verb-base$", calls=0, definition=meaning("хотеть", "present", 0))),
    ("catalog-form", form("знать", "present", 1), dict(path=r"^verb-base$", calls=0, definition=meaning("знать", "present", 1))),
    ("catalog-form", cat("читать")["title"], dict(path=r"^verb-base$", calls=0, definition="читать")),
    # ── русский перевод глагола из каталога ──
    ("russian-gloss", "писать", dict(path=r"^verb-base$", calls=0, definition=cat("писать")["title"])),
    ("russian-gloss", "Читать", dict(path=r"^verb-base$", calls=0, definition=cat("читать")["title"])),
    ("russian-gloss", "хотеть", dict(path=r"^verb-base$", calls=0, definition=cat("хотеть")["title"])),
    # ── русская форма глагола: по фразам из каталога, без модели ──
    ("russian-form", "ходил", dict(path=r"^verb-base$", calls=0, definition=form("ходить", "imperfect", 2))),
    ("russian-form", "пишу", dict(path=r"^verb-base$", calls=0, definition=form("писать", "present", 0))),
    ("russian-form", "она читала", dict(path=r"^verb-base$", calls=0, definition=form("читать", "imperfect", 2))),
    ("russian-form", "мы писали", dict(path=r"^verb-base$", calls=0, definition=form("писать", "imperfect", 3))),
    ("russian-form", "я буду писать", dict(path=r"^verb-base$", calls=0, definition=form("писать", "future", 0))),
    ("russian-form", "хочешь", dict(path=r"^verb-base$", calls=0, definition=form("хотеть", "present", 1))),
    # ── грузинская форма глагола вне каталога, таблица в Викисловаре есть ──
    ("wiktionary-verb", OUT[0]["tenses"]["aorist"][0][0], dict(path=r"verb-wiktionary", status="success")),
    ("wiktionary-verb", OUT[0]["tenses"]["future"][2][0], dict(path=r"^verb-base$", calls=0, status="success")),
    ("wiktionary-verb", OUT[1]["lemma"], dict(path=r"verb-wiktionary", status="success")),
    ("wiktionary-verb", OUT[1]["tenses"]["present"][0][0], dict(path=r"^verb-base$", calls=0, status="success")),
    # ── русский глагол без таблицы в Викисловаре (список «нужных» из REVIEW.md) ──
    ("no-table-verb", "работать", dict(path=r"verb-generated", lemma=lemmas("to work"))),
    ("no-table-verb", "работал", dict(path=r"verb-base-by-infinitive", calls=1, lemma=lemmas("to work"))),
    ("no-table-verb", "давать", dict(path=r"verb-generated", lemma=lemmas("to give"))),
    ("no-table-verb", "помогать", dict(path=r"verb-generated", lemma=lemmas("to help"))),
    # «учить» — и «изучать», и «обучать»: русский Викисловарь даёт оба глагола, годится любой из них.
    ("no-table-verb", "учить", dict(path=r"verb-(generated|existing|wiktionary)", lemma=lemmas("to learn, study") | lemmas("to teach"))),
    ("no-table-verb", WORK[0], dict(path=r"^verb-base$", calls=0, status="success")),
    # ── близкий синоним в базе — не тот глагол ──
    ("same-verb", "сказать", dict(not_definition={TALK["title"], TALK["lemma"]}, lemma=lemmas("to say"), path=r"verb-generated")),
    ("same-verb", "сказал", dict(not_definition={TALK["title"], TALK["lemma"]}, lemma=lemmas("to say"), calls=1)),
    # ── русский глагол, чей грузинский уже сохранён с переводом модели ──
    ("runtime-gloss", "облегчать", dict(status="success", not_path=r"legacy")),
    # ── выдуманный глагол: не должен стать глаголом базы ──
    ("made-up", "глокать", dict(status="not_a_word", not_path=r"verb-(generated|wiktionary|existing)")),
    ("made-up", jumble(cat("писать")["lemma"])[:7] + cat("писать")["lemma"][-1], dict(status="not_a_word", not_path=r"verb-(generated|wiktionary|existing)")),
    # ── опечатки в грузинской форме ──
    ("typo", typo(form("писать", "conditional", 3), "drop"), dict(status="success", info=form("писать", "conditional", 3))),
    ("typo", typo(form("делать", "aorist", 0), "double"), dict(status="success", info=form("делать", "aorist", 0))),
    # ── не глаголы ──
    ("noun", "стол", dict(path=r"not-a-verb>legacy$", calls=1, status="success")),
    ("noun", "арбуз", dict(path=r"not-a-verb>legacy$", calls=1, definition=STARTER["арбуз"])),
    ("noun", STARTER["машина"], dict(path=r"not-a-verb>legacy$", calls=1, status="success")),
    ("noun", STARTER["тарелка"], dict(path=r"not-a-verb>legacy$", calls=1, status="success")),
    ("noun", "привет", dict(status="success", calls=1)),
    ("noun", "спасибо", dict(status="success", calls=1)),
    # ── фразы ──
    ("phrase", "доброе утро", dict(status="success", calls=1)),
    ("phrase", "я хочу пить воду", dict(status="success", calls=1)),
    ("phrase", SENTENCE["ka"].rstrip(".!?"), dict(status="success", calls=1)),
    # ── разговор с ботом и бессмыслица: не переводим и не сохраняем ──
    ("chat", "расскажи анекдот", dict(status="not_a_word", calls=1)),
    ("chat", "как у тебя дела сегодня?", dict(status="not_a_word", calls=1)),
    ("chat", "что ты умеешь делать", dict(status="not_a_word", calls=1)),
    ("gibberish", "ываыва", dict(status="not_a_word", calls=1)),
    ("gibberish", "ффывапрол", dict(status="not_a_word", calls=1)),
    ("gibberish", jumble(STARTER["машина"]), dict(status="not_a_word", calls=1)),
    # ── латиница ──
    # ── латиница: у пользователя грузинский словарь, английские слова в него не переводятся
    #    (это решается до конвейера, в TranslateAndCreateVocabularyEntry) — модель не зовётся ──
    ("latin", "table", dict(status="failure", calls=0)),
    ("latin", "asdfgh", dict(status="failure", calls=0)),
]
if BY_LEXICON:
    CASES.insert(17, ("wiktionary-verb", BY_LEXICON[4][0], dict(path=r"^lexicon>verb-wiktionary$", calls=0, status="success")))
if args.only:
    CASES = [c for c in CASES if c[0] in args.only.split(",")]


def sql(query):
    return subprocess.run(["docker", "exec", args.container, "psql", "-U", "dev", "-d", "tralebot", "-qtAc", query],
                          check=True, capture_output=True, text=True).stdout.strip()


def init_data(telegram_id):
    fields = {"auth_date": str(int(time.time())), "query_id": "local",
              "user": json.dumps({"id": telegram_id, "first_name": "Eval"}, separators=(",", ":"))}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


def reset():
    for user, settings, telegram in USERS:
        sql(f"""insert into "Users" ("Id","TelegramId","AccountType","RegisteredAtUtc","UserSettingsId","InitialLanguageSet","IsActive","IsPro","TrialBonusDays","NotificationsEnabled")
                values ('{user}',{telegram},0,now(),'{settings}',true,true,false,0,true)
                on conflict ("Id") do update set "RegisteredAtUtc" = now();
                insert into "UsersSettings" ("Id","UserId","CurrentLanguage") values ('{settings}','{user}',1) on conflict do nothing;
                delete from "VocabularyEntries" where "UserId"='{user}';
                delete from "Achievements" where "UserId"='{user}';""")
    sql("""delete from "TranslationCache"; delete from "Verbs" where "ContentHash" not like 'cat:%';""")


LINE = re.compile(r"Translation of (.*?): path (.*?), (\w+), (\d+) ms, model calls (\d+) \(classifier (\d+)x(\d+)/(\d+), analyst (\d+)x(\d+)/(\d+)\)")


def translate(word, auth):
    offset = os.path.getsize(args.log)
    request = urllib.request.Request(f"http://localhost:{args.port}/api/miniapp/translate",
                                     data=json.dumps({"word": word}).encode(),
                                     headers={"X-Telegram-Init-Data": auth, "Content-Type": "application/json"})
    started = time.time()
    try:
        answer = json.load(urllib.request.urlopen(request, timeout=180))
    except urllib.error.HTTPError as e:
        try:
            answer = json.loads(e.read().decode())
            answer.setdefault("status", f"http {e.code}")
        except Exception:
            answer = {"status": f"http {e.code}"}
    seconds = time.time() - started
    time.sleep(0.15)  # лог пишется после ответа
    with open(args.log, encoding="utf8", errors="replace") as log:
        log.seek(offset)
        lines = LINE.findall(log.read())
    trace = None
    if lines:
        _, path, _, _, calls, cc, ci, co, ac, ai, ao = lines[-1]
        trace = dict(path=path, calls=int(calls), classifier=(int(cc), int(ci), int(co)), analyst=(int(ac), int(ai), int(ao)))
    return answer, seconds, trace


def judge(expect, answer, trace):
    problems = []
    path = trace["path"] if trace else "(нет строки в логе)"
    calls = trace["calls"] if trace else 0
    if "status" in expect and answer.get("status") != expect["status"]:
        problems.append(f"статус {answer.get('status')}, ждали {expect['status']}")
    if "path" in expect and not re.search(expect["path"], path):
        problems.append(f"путь не {expect['path']}")
    if "not_path" in expect and re.search(expect["not_path"], path):
        problems.append(f"путь содержит {expect['not_path']}")
    if "calls" in expect and calls > expect["calls"]:
        problems.append(f"обращений к моделям {calls}, ждали не больше {expect['calls']}")
    definition = (answer.get("definition") or "").strip().lower()
    if "definition" in expect:
        allowed = expect["definition"] if isinstance(expect["definition"], set) else {expect["definition"]}
        if definition not in {a.lower() for a in allowed}:
            problems.append(f"перевод «{definition}», ждали {' / '.join(sorted(allowed))}")
    if "not_definition" in expect and definition in {a.lower() for a in expect["not_definition"]}:
        problems.append(f"перевод «{definition}» — это соседний глагол")
    if "lemma" in expect:
        # Ответ — масдар или лемма глагола базы; сверяется лемма этого глагола.
        stored = set(sql(f"""select "Lemma" from "Verbs" where lower("Title")='{definition}' or "Lemma"='{definition}'""").split())
        if not stored & expect["lemma"]:
            problems.append(f"глагол {' / '.join(sorted(stored)) or '«' + definition + '»'}, ждали {' / '.join(sorted(expect['lemma']))}")
    if "info" in expect and expect["info"] not in (answer.get("additionalInfo") or "") + definition:
        problems.append(f"в ответе нет {expect['info']}")
    return problems


def cost(trace):
    if not trace:
        return 0.0
    (pi, po), (ai, ao) = PRICES.get(args.classifier, (0, 0)), PRICES.get(args.analyst, (0, 0))
    return (trace["classifier"][1] * pi + trace["classifier"][2] * po + trace["analyst"][1] * ai + trace["analyst"][2] * ao) / 1e6


def run_pass(title, auth, check):
    print(f"\n== {title} ==")
    rows = []
    for group, word, expect in CASES:
        answer, seconds, trace = translate(word, auth)
        problems = judge(expect, answer, trace) if check else []
        rows.append(dict(group=group, word=word, status=answer.get("status"), definition=answer.get("definition"),
                         seconds=seconds, trace=trace, problems=problems))
        t = trace or dict(path="—", calls=0, classifier=(0, 0, 0), analyst=(0, 0, 0))
        tokens = f"{t['classifier'][1] + t['analyst'][1]}/{t['classifier'][2] + t['analyst'][2]}"
        verdict = "ok" if not problems else "FAIL: " + "; ".join(problems)
        print(f"[{group}] «{word}» → {answer.get('status')} «{answer.get('definition') or ''}» | {t['path']} | "
              f"модель: {t['calls']} ({tokens} ток.) | {seconds:.1f} c | {verdict}")
    return rows


def percentile(values, share):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(share * (len(values) - 1))))] if values else 0.0


reset()
first = run_pass(f"первый проход — классификатор {args.classifier}, аналитик {args.analyst}", init_data(USERS[0][2]), True)
second = run_pass("второй проход — те же запросы от другого пользователя", init_data(USERS[1][2]), False)

failed = [r for r in first if r["problems"]]
with_model = [r["seconds"] for r in first if r["trace"] and r["trace"]["calls"] > 0]
with_analyst = [r["seconds"] for r in first if r["trace"] and r["trace"]["analyst"][0] > 0]
classifier_only = [r["seconds"] for r in first if r["trace"] and r["trace"]["calls"] > 0 and r["trace"]["analyst"][0] == 0]
total_cost = sum(cost(r["trace"]) for r in first)
calls_first = sum(r["trace"]["calls"] for r in first if r["trace"])
calls_second = sum(r["trace"]["calls"] for r in second if r["trace"])
changed = [r["word"] for a, r in zip(first, second) if (a["status"], a["definition"]) != (r["status"], r["definition"])]

print("\n== итог ==")
print(f"модели: классификатор {args.classifier}, аналитик {args.analyst}")
print(f"прошло {len(first) - len(failed)} из {len(first)}" + ("" if not failed else "; не прошли: " + ", ".join(f"«{r['word']}»" for r in failed)))
print(f"обращений к моделям: первый проход {calls_first}, второй проход {calls_second} (должно быть 0)")
if changed:
    print("во втором проходе ответ отличается: " + ", ".join(f"«{w}»" for w in changed))
print(f"запросы с моделью: {len(with_model)}; время p50 {percentile(with_model, .5):.1f} c, p95 {percentile(with_model, .95):.1f} c")
print(f"  только классификатор: {len(classifier_only)}; p50 {percentile(classifier_only, .5):.1f} c, p95 {percentile(classifier_only, .95):.1f} c")
print(f"  с аналитиком: {len(with_analyst)}; p50 {percentile(with_analyst, .5):.1f} c, p95 {percentile(with_analyst, .95):.1f} c")
print(f"цена первого прохода ${total_cost:.5f}; на 1000 новых запросов такого же состава ≈ ${total_cost / len(first) * 1000:.3f}")
if args.json:
    json.dump(dict(classifier=args.classifier, analyst=args.analyst, first=first, second=second), open(args.json, "w"),
              ensure_ascii=False, indent=1, default=list)
sys.exit(1 if failed or calls_second else 0)
