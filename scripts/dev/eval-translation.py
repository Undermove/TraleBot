#!/usr/bin/env python3
"""Оценка конвейера перевода на настоящей модели: фиксированный набор запросов с ожидаемым исходом.

Скрипт ничего не знает о ключах: он ходит в уже запущенный локальный бэкенд (агент перевода включён,
модели заданы при запуске сервера) и читает из его лога строку «Translation of …: path …» — путь,
число обращений к моделям и токены каждого запроса.

    python3 scripts/dev/eval-translation.py --log <файл лога сервера> \
        [--port 1421] [--container tralebot-ai-db] [--classifier gpt-6-luna] [--analyst gpt-6-luna]
        [--generator gpt-6-astra] [--reviewer gpt-6-sol] [--only группа,…]
        [--save-ordinary файл.json]   # сервер с выключенным агентом: записать ответы старого пути на обычные слова
        [--baseline файл.json]        # сравнить ответы на обычные слова с записанными
        [--compare файл.json]         # вместо набора: сравнение модели-составителя (см. ниже)

Названия моделей нужны только для подсчёта цены — сами модели задаются при запуске сервера.

Что делает:
  1. чистит то, что накопили прошлые прогоны (кэш переводов, глаголы не из каталога, словари двух
     тестовых пользователей) — каждый прогон начинается с одного и того же состояния;
  2. первый проход — все запросы от пользователя A: путь, обращения к моделям, секунды, вердикт;
  3. второй проход — те же запросы от пользователя B: обращений к моделям должно быть ноль;
  4. итог: сколько прошло, p50/p95 времени запросов, дошедших до модели, цена 1000 новых запросов;
  5. по каждому глаголу, который составила модель: вердикт второй модели и её доводы, сколько форм
     встретилось в настоящих текстах, токены и цена по ролям, секунды; карточка, словарь и игра для него;
  6. обычные слова и предложения: каждое должно пойти старым путём (сайт-словарь, потом Google) и
     получить тот же ответ, что без агента (--baseline); считается, сколько из них классификатор
     ошибочно отправил по глагольному пути и чем это кончилось.

Режим --compare: сервер запущен с проверяемой моделью-составителем; для списка глаголов вызывается
/api/admin/verbs/generate-preview (ничего не сохраняет). Для глаголов без таблицы — вердикт второй
модели и доля форм, встретившихся в текстах; для глаголов с таблицей в Викисловаре (каталог) — «вслепую»:
составить без таблицы и сравнить с таблицей клетка за клеткой.

Грузинские слова в наборе не набраны руками: они берутся из каталога (src/Trale/Verbs/verbs.json),
лексикона (lexicon.json), выгрузки парадигм (scripts/verbs/verbs.raw.json), предложений Tatoeba
(sentences.raw.json) и стартовой колоды (QuizCreator.cs) — по русскому переводу или английскому толкованию.
"""
import argparse, hashlib, hmac, json, os, re, statistics, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OWNER = ("a1a1a1a1-0000-0000-0000-000000000009", "a1a1a1a1-0000-0000-0000-0000000000a9", 309149393)  # для /api/admin
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
ap.add_argument("--generator", default="gpt-6-astra")
ap.add_argument("--reviewer", default="gpt-6-sol")
ap.add_argument("--save-ordinary", default="")
ap.add_argument("--baseline", default="")
ap.add_argument("--compare", default="")
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
SAY_LEMMAS = {r[0] for r in LEXICON.values() if "to say" in r[3]}
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
    # ── русский перевод глагола из каталога: начальная форма (лемма), рядом название действия ──
    ("russian-gloss", "писать", dict(path=r"^verb-base$", calls=0, definition=cat("писать")["lemma"], info=cat("писать")["title"])),
    ("russian-gloss", "Читать", dict(path=r"^verb-base$", calls=0, definition=cat("читать")["lemma"])),
    ("russian-gloss", "хотеть", dict(path=r"^verb-base$", calls=0, definition=cat("хотеть")["lemma"])),
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
    # ── примеры владельца: глагола «сказать» нет ни в базе, ни в таблицах Викисловаря ──
    #    первый запрос — составление и одобрение; дальше всё из таблицы, без модели
    ("owner", "я сказал", dict(path=r"generator>stored", cell=(SAY_LEMMAS, "aorist", 0), not_definition={TALK["title"], TALK["lemma"]})),
    ("owner", "я скажу", dict(path=r"^verb-base$", calls=0, cell=(SAY_LEMMAS, "future", 0))),
    ("owner", "он сказал мне", dict(path=r"^verb-base$", calls=0, cell=(SAY_LEMMAS, "aorist", 2))),
    ("owner", "сказать", dict(path=r"^verb-base$", calls=0, lemma=SAY_LEMMAS)),
    ("owner", "сказал", dict(path=r"^verb-base$", calls=0, cell=(SAY_LEMMAS, "aorist", 2))),
    ("owner", "скажу", dict(path=r"^verb-base$", calls=0, cell=(SAY_LEMMAS, "future", 0))),
    ("owner", "ему сказали", dict(path=r"^verb-base$", calls=0, cell=(SAY_LEMMAS, "aorist", 5))),
    # ── глаголы из списка «нужных» (REVIEW.md), каждый спрошен дважды: второй раз — из таблицы ──
    ("twice", "работать", dict(path=r"generator>stored", lemma=lemmas("to work"))),
    ("twice", "работать", dict(path=r"^verb-base$", calls=0, lemma=lemmas("to work"))),
    # «учить» — и «изучать», и «обучать»: русский Викисловарь даёт оба глагола, годится любой из них.
    ("twice", "учить", dict(path=r"generator>(stored|existing)|verb-(existing|wiktionary)", lemma=lemmas("to learn, study") | lemmas("to teach"))),
    ("twice", "учить", dict(calls=0, lemma=lemmas("to learn, study") | lemmas("to teach"))),
    ("twice", "давать", dict(path=r"generator>stored", lemma=lemmas("to give"))),
    ("twice", "давать", dict(path=r"^verb-base$", calls=0, lemma=lemmas("to give"))),
    ("twice", "помогать", dict(path=r"generator>stored", lemma=lemmas("to help"))),
    ("twice", "помогать", dict(path=r"^verb-base$", calls=0, lemma=lemmas("to help"))),
    ("twice", "ждать", dict(path=r"^verb-base$", calls=0, definition=cat("ждать")["lemma"])),
    ("twice", "ждать", dict(path=r"^verb-base$", calls=0, definition=cat("ждать")["lemma"])),
    # ── формы только что составленного глагола: из таблицы, без модели ──
    ("made-verb-form", "работал", dict(path=r"^verb-base$", calls=0, cell=(lemmas("to work"), "imperfect", 2))),
    ("made-verb-form", "мы работаем", dict(path=r"^verb-base$", calls=0, cell=(lemmas("to work"), "present", 3))),
    ("made-verb-form", WORK[0], dict(path=r"^verb-base$", calls=0, definition="он работает")),
    # ── выдуманный глагол: не должен стать глаголом базы; ответ должен быть одним и тем же ──
    ("made-up", "глокать", dict(status="not_a_word", not_path=r"stored|verb-(wiktionary|existing)")),
    # Грузинская бессмыслица, похожая на форму глагола: глаголом базы стать не должна. «Не слово» она или
    # перевод старым путём — решает классификатор (по одним лишь корпусам текстов мы больше не отказываем).
    ("made-up", jumble(cat("писать")["lemma"])[:7] + cat("писать")["lemma"][-1], dict(status_in={"not_a_word", "success"}, not_path=r"stored|verb-(wiktionary|existing)")),
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
    # ── бессмыслица одним словом: не переводим и не сохраняем ──
    ("gibberish", "ываыва", dict(status="not_a_word", calls=1)),
    ("gibberish", "ффывапрол", dict(status="not_a_word", calls=1)),
    ("gibberish", jumble(STARTER["машина"]), dict(status="not_a_word", calls=1)),
    # ── латиница ──
    # ── латиница: у пользователя грузинский словарь, английские слова в него не переводятся
    #    (это решается до конвейера, в TranslateAndCreateVocabularyEntry) — модель не зовётся ──
    ("latin", "table", dict(status="failure", calls=0)),
    ("latin", "asdfgh", dict(status="failure", calls=0)),
]
# ── обычные слова и предложения: только старый путь (сайт-словарь, потом Google), ответ как без агента ──
ORDINARY = ["слива", "дом", "окно", "хлеб", "собака", "яблоко", "вода", "книга", "город", "улица",
            "красивый", "большой", "холодный", "новый", "вкусный",
            "быстро", "завтра", "очень",
            "чашка кофе", "большой дом", "красное вино",
            "где находится вокзал", "сколько это стоит", "я хочу купить билет", "мы завтра идём в кино",
            "он сказал мне правду вчера", "мне нужна помощь", "это очень вкусно",
            # Фразы, похожие на обращение к боту: фраза из настоящих слов переводится всегда.
            "расскажи анекдот", "как у тебя дела сегодня?", "что ты умеешь делать", "как тебя зовут", "как дела",
            "помогите мне пожалуйста", "ты говоришь по-русски", "дайте счёт пожалуйста", "где туалет"]
OLD_PATH = r"(^|>)(legacy|cache)$"
CASES += [("ordinary", text, dict(status="success", path=OLD_PATH, calls=1, same_as_baseline=True)) for text in ORDINARY]
# Глагол с местоимениями — глагольный путь (как «он сказал мне»): ответ — форма из таблицы.
CASES += [("verb-with-pronouns", "я тебя люблю", dict(status="success"))]
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
    user, settings, telegram = OWNER
    sql(f"""insert into "Users" ("Id","TelegramId","AccountType","RegisteredAtUtc","UserSettingsId","InitialLanguageSet","IsActive","IsPro","TrialBonusDays","NotificationsEnabled")
            values ('{user}',{telegram},0,now(),'{settings}',true,true,false,0,true) on conflict ("Id") do nothing;
            insert into "UsersSettings" ("Id","UserId","CurrentLanguage") values ('{settings}','{user}',1) on conflict do nothing;""")
    if not args.compare:
        sql("""delete from "TranslationCache"; delete from "Verbs" where "ContentHash" not like 'cat:%';""")


LINE = re.compile(r"Translation of (.*?): path (.*?), (\w+), (\d+) ms, model calls (\d+) \(classifier (\d+)x(\d+)/(\d+), analyst (\d+)x(\d+)/(\d+)"
                  r"(?:, generator (\d+)x(\d+)/(\d+), reviewer (\d+)x(\d+)/(\d+))?\)")
ROLES = ("classifier", "analyst", "generator", "reviewer")
NO_TRACE = dict(path="—", calls=0, **{role: (0, 0, 0) for role in ROLES})


def call(method, path, auth, body=None, timeout=300):
    request = urllib.request.Request(f"http://localhost:{args.port}{path}", method=method,
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"X-Telegram-Init-Data": auth, "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(request, timeout=timeout))
    except urllib.error.HTTPError as e:
        try:
            answer = json.loads(e.read().decode())
        except Exception:
            answer = {}
        answer.setdefault("status", f"http {e.code}")
        return answer


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
        path, calls, numbers = lines[-1][1], lines[-1][4], [int(n or 0) for n in lines[-1][5:]]
        trace = dict(path=path, calls=int(calls), **{role: tuple(numbers[i * 3:i * 3 + 3]) for i, role in enumerate(ROLES)})
    return answer, seconds, trace


def judge(expect, answer, trace, word=None):
    problems = []
    path = trace["path"] if trace else "(нет строки в логе)"
    calls = trace["calls"] if trace else 0
    if answer.get("status") == "exists" and trace is None:
        # То же слово от того же пользователя: ответ из его собственного словаря, конвейер не вызывался.
        expect = {k: v for k, v in expect.items() if k not in ("path", "status")}
    if "status_in" in expect and answer.get("status") not in expect["status_in"]:
        problems.append(f"статус {answer.get('status')}, ждали один из {sorted(expect['status_in'])}")
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
    if "cell" in expect:
        # Ответ — форма сохранённого глагола в названной клетке таблицы (время, лицо).
        wanted, tense, person = expect["cell"]
        quoted = ",".join(f"'{lemma}'" for lemma in wanted)
        forms = set(sql(f"""select f."Form" from "VerbForms" f join "Verbs" v on v."Id"=f."VerbId"
                            where v."Lemma" in ({quoted}) and f."Tense"='{tense}' and f."Person"={person}""").split())
        if definition not in forms:
            problems.append(f"перевод «{definition}», ждали форму {tense}/{person}: {' / '.join(sorted(forms)) or 'такого глагола в базе нет'}")
    if expect.get("same_as_baseline") and BASELINE:
        old = BASELINE.get(word)
        if old is None:
            problems.append("нет ответа старого пути для сравнения")
        elif (old["status"], old["definition"]) != (answer.get("status"), answer.get("definition")):
            problems.append(f"старый путь без агента отвечал «{old['definition']}» ({old['status']})")
    if "lemma" in expect:
        # Ответ — масдар или лемма глагола базы; сверяется лемма этого глагола.
        stored = set(sql(f"""select "Lemma" from "Verbs" where lower("Title")='{definition}' or "Lemma"='{definition}'""").split())
        if not stored & expect["lemma"]:
            problems.append(f"глагол {' / '.join(sorted(stored)) or '«' + definition + '»'}, ждали {' / '.join(sorted(expect['lemma']))}")
    if "info" in expect and expect["info"] not in (answer.get("additionalInfo") or "") + definition:
        problems.append(f"в ответе нет {expect['info']}")
    return problems


MODELS = dict(classifier=args.classifier, analyst=args.analyst, generator=args.generator, reviewer=args.reviewer)


def role_cost(role, tokens_in, tokens_out):
    price_in, price_out = PRICES.get(MODELS[role], (0, 0))
    return (tokens_in * price_in + tokens_out * price_out) / 1e6


def cost(trace):
    return sum(role_cost(role, trace[role][1], trace[role][2]) for role in ROLES) if trace else 0.0


def run_pass(title, auth, check):
    print(f"\n== {title} ==")
    rows = []
    for group, word, expect in CASES:
        answer, seconds, trace = translate(word, auth)
        problems = judge(expect, answer, trace, word) if check else []
        rows.append(dict(group=group, word=word, status=answer.get("status"), definition=answer.get("definition"),
                         seconds=seconds, trace=trace, problems=problems))
        t = trace or NO_TRACE
        tokens = f"{sum(t[r][1] for r in ROLES)}/{sum(t[r][2] for r in ROLES)}"
        verdict = "ok" if not problems else "FAIL: " + "; ".join(problems)
        print(f"[{group}] «{word}» → {answer.get('status')} «{answer.get('definition') or ''}» | {t['path']} | "
              f"модель: {t['calls']} ({tokens} ток.) | {seconds:.1f} c | {verdict}")
    return rows


def percentile(values, share):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(share * (len(values) - 1))))] if values else 0.0


BASELINE = {r["word"]: r for r in json.load(open(args.baseline, encoding="utf8"))} if args.baseline else {}
OWNER_AUTH = init_data(OWNER[2])
MAIN = ("present", "imperfect", "future", "conditional", "aorist", "optative")


def compare_generators():
    """Одна модель-составитель на списке глаголов: без таблицы — по вердикту и текстам, с таблицей — вслепую против таблицы."""
    wanted = load("scripts/verbs/wanted.json")
    missing = [w for w in wanted if w["lemma"] not in IN_CATALOG][:8]
    blind = [v for v in CATALOG if v["kind"] in ("pattern", "special") and all(t in v["tenses"] for t in MAIN) and "," not in v["ru"]
             and "(" not in v["ru"]]
    blind = [v for i, v in enumerate(blind) if i % max(1, len(blind) // 8) == 0][:8]
    # Глаголы пореже: таблица в Викисловаре есть, в каталог не взяты. Спрашиваются грузинской леммой.
    rest = [v for v in RAW if v["lemma"] not in IN_CATALOG and v["lemma"] not in SKIPPED
            and all(len(v["tenses"].get(t, [])) == 6 and all(v["tenses"][t]) for t in MAIN)]
    rare = [v for i, v in enumerate(rest) if i % max(1, len(rest) // 12) == 0][:12]
    rows = []
    print(f"\n== составитель {args.generator}, проверяющий {args.reviewer} ==")
    plan = ([("no-table", w["ru"].split(",")[0].strip(), None) for w in missing] + [("blind", v["ru"], v) for v in blind]
            + [("blind-rare", v["lemma"], v) for v in rare])
    if args.only:
        plan = [p for p in plan if p[0] in args.only.split(",")]
    for kind, ru, table in plan:
        answer = call("POST", "/api/admin/verbs/generate-preview", OWNER_AUTH,
                      dict(text=ru, infinitive=None if kind == "blind-rare" else ru))
        g, r = answer.get("generator") or {}, answer.get("reviewer") or {}
        row = dict(kind=kind, ru=ru, outcome=answer.get("outcome"), reason=answer.get("reason"), lemma=answer.get("lemma"),
                   approved=answer.get("approved"), reasons=answer.get("reasons") or [], repair=answer.get("repairRounds", 0),
                   attested=answer.get("formsAttested"), total=answer.get("formsTotal"), seconds=answer.get("seconds", 0),
                   generator=(g.get("calls", 0), g.get("inputTokens", 0), g.get("outputTokens", 0)),
                   reviewer=(r.get("calls", 0), r.get("inputTokens", 0), r.get("outputTokens", 0)))
        row["cost"] = role_cost("generator", *row["generator"][1:]) + role_cost("reviewer", *row["reviewer"][1:])
        if kind == "no-table":
            row["lemma_ok"] = answer.get("lemma") in {w["lemma"] for w in missing if w["ru"].split(",")[0].strip() == ru}
        if table is not None and answer.get("tenses"):
            cells = same = 0
            wrong = []
            for tense in MAIN:
                generated = answer["tenses"].get(tense) or [[]] * 6
                for person in range(6):
                    if not generated[person]:
                        continue  # пустая клетка — не ошибка
                    allowed = set(table["tenses"][tense][person])
                    for alt in table.get("alt") or []:
                        allowed |= set((alt.get(tense) or [[]] * 6)[person])
                    cells += 1
                    same += generated[person][0] in allowed
                    if generated[person][0] not in allowed:
                        wrong.append(f"{tense}/{person}: {generated[person][0]} ≠ {' / '.join(sorted(allowed))}")
            row.update(lemma_ok=answer.get("lemma") == table["lemma"], cells=cells, same=same, wrong=wrong)
        rows.append(row)
        extra = (f"таблица: {row['same']}/{row['cells']} клеток" if "cells" in row else
                 f"в текстах {row['attested']}/{row['total']}") + f", лемма {'та' if row.get('lemma_ok') else 'НЕ ТА'}"
        print(f"[{kind}] «{ru}» → {row['outcome']}{'+repair' if row['repair'] else ''} {row['lemma'] or ''} | {extra} | "
              f"ген. {row['generator'][1]}/{row['generator'][2]} ток., пров. {row['reviewer'][1]}/{row['reviewer'][2]} ток. | "
              f"${row['cost']:.4f} | {row['seconds']:.0f} c")
        for reason in row["reasons"] if row["outcome"] != "approved" else []:
            print(f"      довод: {reason}")
        for w in row.get("wrong", [])[:6]:
            print(f"      не как в таблице: {w}")

    no_table, blinds = [r for r in rows if r["kind"] == "no-table"], [r for r in rows if r["kind"] == "blind"]
    rares = [r for r in rows if r["kind"] == "blind-rare"]
    if rares:
        rare_cells, rare_same = sum(r.get("cells", 0) for r in rares), sum(r.get("same", 0) for r in rares)
        print(f"\nредкие глаголы вслепую ({args.generator}): написано {sum(1 for r in rares if r.get('cells'))} из {len(rares)}, "
              f"одобрено {sum(r['outcome'] == 'approved' for r in rares)}, клеток совпало {rare_same} из {rare_cells} "
              f"({100 * rare_same / max(1, rare_cells):.1f}%), одобрено с ошибкой в таблице "
              f"{sum(1 for r in rares if r['outcome'] == 'approved' and r.get('cells', 0) != r.get('same', 0))}; "
              f"в среднем ${statistics.mean(r['cost'] for r in rares):.4f} за глагол")
    if not no_table and not blinds:
        json.dump(dict(generator=args.generator, reviewer=args.reviewer, rows=rows), open(args.compare, "w"), ensure_ascii=False, indent=1)
        return
    cells, same = sum(r.get("cells", 0) for r in blinds), sum(r.get("same", 0) for r in blinds)
    attested, total = sum(r["attested"] or 0 for r in no_table), sum(r["total"] or 0 for r in no_table)
    print("\n== итог сравнения ==")
    print(f"составитель {args.generator}: глаголы без таблицы — одобрено {sum(r['outcome'] == 'approved' for r in no_table)} из {len(no_table)}, "
          f"лемма та же, что в списке «нужных» — {sum(bool(r.get('lemma_ok')) for r in no_table)}, форм в текстах {attested}/{total}")
    print(f"  вслепую против таблицы Викисловаря: лемма совпала {sum(bool(r.get('lemma_ok')) for r in blinds)} из {len(blinds)}, "
          f"клеток совпало {same} из {cells} ({100 * same / max(1, cells):.1f}%), одобрено {sum(r['outcome'] == 'approved' for r in blinds)}")
    print(f"  цена: в среднем ${statistics.mean(r['cost'] for r in rows):.4f} за глагол; время p50 {percentile([r['seconds'] for r in rows], .5):.0f} c, "
          f"макс. {max(r['seconds'] for r in rows):.0f} c; кругов исправления {sum(r['repair'] for r in rows)}")
    json.dump(dict(generator=args.generator, reviewer=args.reviewer, rows=rows), open(args.compare, "w"), ensure_ascii=False, indent=1)


def made_verbs_report(auth, user_id):
    """Каждый глагол, составленный моделью: на чём держится одобрение и стал ли он полноценным глаголом."""
    made = call("GET", "/api/admin/verbs/model-made", OWNER_AUTH).get("verbs") or []
    problems = []
    print(f"\n== глаголы, составленные моделью: {len(made)} ==")
    for verb in made:
        lemma = verb["lemma"]
        request = next((r for r in first if r["trace"] and r["trace"]["generator"][0] and r["word"] == verb["askedText"]), None)
        t = request["trace"] if request else NO_TRACE
        by_role = ", ".join(f"{role} {t[role][1]}/{t[role][2]} ток. ${role_cost(role, t[role][1], t[role][2]):.4f}" for role in ROLES if t[role][0])
        print(f"{lemma} — {verb['translation']} (по запросу «{verb['askedText']}»): одобрен {verb['reviewerModel']}, составлен {verb['generatorModel']}"
              f"{', после одного исправления' if verb['repairRounds'] else ''}; в текстах {verb['formsAttested']}/{verb['formsTotal']} форм; "
              f"в лексиконе {'есть' if verb['lemmaInLexicon'] else 'нет'}")
        print(f"   {by_role or 'токены: нет строки запроса'}; всего ${cost(t):.4f}; {request['seconds'] if request else 0:.0f} c")
        for reason in verb["reviewerReasons"]:
            print(f"   довод: {reason}")
        if verb["unattestedForms"]:
            print(f"   не встретились в текстах: {', '.join(verb['unattestedForms'])}")

        quoted = urllib.parse.quote(lemma)
        card = call("GET", f"/api/miniapp/verbs/{quoted}", auth)
        meanings = card.get("meanings") or {}
        if card.get("status") != "generated" or not all(len(meanings.get(t) or []) == 6 for t in (card.get("tenses") or {}) if t in MAIN):
            problems.append(f"{lemma}: карточка без фраз или не generated")
        learning = call("GET", f"/api/miniapp/verbs/{quoted}/learning", auth)
        if not (learning.get("progress") or {}).get("canLearn") or not (learning.get("progress") or {}).get("total"):
            problems.append(f"{lemma}: /learning не разрешает сессию")
    # Словарь: слово, сохранённое переводом, помечено как глагол.
    entries = call("GET", "/api/miniapp/vocabulary", auth)
    words = entries.get("entries") or entries.get("vocabulary") or entries.get("items") or []
    marked = {(e.get("verb") or {}).get("verbId") or (e.get("verb") or {}).get("id") for e in words if e.get("verb")}
    for verb in made:
        if verb["lemma"] not in marked:
            problems.append(f"{verb['lemma']}: в словаре нет записи, помеченной этим глаголом")
    print("карточка с фразами, словарь, разрешение на сессию: " + ("всё на месте" if not problems else "ПРОБЛЕМЫ: " + "; ".join(problems)))
    return made, problems


reset()
if args.compare:
    compare_generators()
    sys.exit(0)
if args.save_ordinary:
    # Сервер запущен без агента: ответы старого пути на обычные слова — образец для сравнения.
    CASES = [c for c in CASES if c[0] == "ordinary"]
    rows = run_pass("обычные слова старым путём (агент выключен)", init_data(USERS[0][2]), False)
    json.dump(rows, open(args.save_ordinary, "w"), ensure_ascii=False, indent=1, default=list)
    print(f"записано {len(rows)} ответов в {args.save_ordinary}")
    sys.exit(0)

title = f"классификатор {args.classifier}, аналитик {args.analyst}, составитель {args.generator}, проверяющий {args.reviewer}"
first = run_pass(f"первый проход — {title}", init_data(USERS[0][2]), True)
made, made_problems = made_verbs_report(init_data(USERS[0][2]), USERS[0][0])
second = run_pass("второй проход — те же запросы от другого пользователя", init_data(USERS[1][2]), False)

failed = [r for r in first if r["problems"]]
with_model = [r["seconds"] for r in first if r["trace"] and r["trace"]["calls"] > 0]
with_analyst = [r["seconds"] for r in first if r["trace"] and r["trace"]["analyst"][0] > 0]
with_generator = [r for r in first if r["trace"] and r["trace"]["generator"][0] > 0]
classifier_only = [r["seconds"] for r in first if r["trace"] and r["trace"]["calls"] > 0 and r["trace"]["analyst"][0] == 0 and r["trace"]["generator"][0] == 0]
total_cost = sum(cost(r["trace"]) for r in first)
calls_first = sum(r["trace"]["calls"] for r in first if r["trace"])
calls_second = sum(r["trace"]["calls"] for r in second if r["trace"])
changed = [r["word"] for a, r in zip(first, second) if (a["status"], a["definition"]) != (r["status"], r["definition"])]

print("\n== итог ==")
print(f"модели: {title}")
print(f"прошло {len(first) - len(failed)} из {len(first)}" + ("" if not failed else "; не прошли: " + ", ".join(f"«{r['word']}»" for r in failed)))
print(f"обращений к моделям: первый проход {calls_first}, второй проход {calls_second} (должно быть 0)")
if changed:
    print("во втором проходе ответ отличается: " + ", ".join(f"«{w}»" for w in changed))
print(f"запросы с моделью: {len(with_model)}; время p50 {percentile(with_model, .5):.1f} c, p95 {percentile(with_model, .95):.1f} c")
print(f"  только классификатор: {len(classifier_only)}; p50 {percentile(classifier_only, .5):.1f} c, p95 {percentile(classifier_only, .95):.1f} c")
print(f"  с аналитиком: {len(with_analyst)}; p50 {percentile(with_analyst, .5):.1f} c, p95 {percentile(with_analyst, .95):.1f} c")
if with_generator:
    seconds = [r["seconds"] for r in with_generator]
    spent = [cost(r["trace"]) for r in with_generator]
    print(f"  с составителем: {len(with_generator)}; p50 {percentile(seconds, .5):.1f} c, макс. {max(seconds):.1f} c; "
          f"цена запроса с составлением в среднем ${statistics.mean(spent):.4f}, макс. ${max(spent):.4f}")
by_role = {role: sum(role_cost(role, r["trace"][role][1], r["trace"][role][2]) for r in first if r["trace"]) for role in ROLES}
print("цена первого прохода по ролям: " + ", ".join(f"{role} ${value:.4f}" for role, value in by_role.items()))
plain = [r for r in first if r["trace"] and r["trace"]["generator"][0] == 0]
plain_cost = sum(cost(r["trace"]) for r in plain)
print(f"цена первого прохода ${total_cost:.4f}; запрос без составления глагола в среднем ${plain_cost / max(1, len(plain)):.6f} "
      f"(1000 таких новых запросов ≈ ${plain_cost / max(1, len(plain)) * 1000:.3f})")

ordinary = [r for r in first if r["group"] == "ordinary"]
if ordinary:
    misrouted = [r for r in ordinary if r["trace"] and re.search(r"analyst|generator|lexicon|verb-", r["trace"]["path"])]
    old_way = [r for r in ordinary if r["trace"] and re.search(OLD_PATH, r["trace"]["path"]) and r["status"] == "success"]
    print(f"обычные слова и предложения: {len(ordinary)}; старым путём с ответом — {len(old_way)}; "
          f"ошибочно отправлены классификатором по глагольному пути — {len(misrouted)}"
          + ("" if not BASELINE else f"; ответ совпал с ответом без агента — {sum(1 for r in ordinary if BASELINE.get(r['word']) and (BASELINE[r['word']]['status'], BASELINE[r['word']]['definition']) == (r['status'], r['definition']))}"))
    for r in misrouted:
        print(f"   «{r['word']}»: {r['trace']['path']} → {r['status']} «{r['definition']}»")
if args.json:
    json.dump(dict(models=MODELS, first=first, second=second, made=made), open(args.json, "w"),
              ensure_ascii=False, indent=1, default=list)
sys.exit(1 if failed or calls_second or made_problems else 0)
