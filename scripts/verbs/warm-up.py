#!/usr/bin/env python3
"""Прогрев базы глаголов: один раз провести «нужные» глаголы, которых нет в каталоге, через тот же
конвейер перевода, которым пользуется человек (база → таблица Викисловаря → составление сильной
моделью и одобрение второй), и напечатать отчёт.

    python3 scripts/verbs/warm-up.py --url http://localhost:1421 --init-data "<initData владельца>" [--limit 5] [--dry]
    python3 scripts/verbs/warm-up.py --local [--port 1421] [--container tralebot-ai-db]   # локальный сервер: подпись выдуманным токеном

Откуда список: scripts/verbs/wanted.json (частые глаголы, см. раздел о недостающих в scripts/verbs/REVIEW.md)
минус то, что уже есть в каталоге src/Trale/Verbs/verbs.json. Спрашивается русский инфинитив — как спросил бы человек.

Куда пишется результат: прямо в базу, через POST /api/admin/verbs/warm-up (только для владельца).
Файла данных нет намеренно — так у составленных моделью глаголов остаётся один источник правды:
  • каталог verbs.json — только глаголы, прослеженные до открытого источника, он собирается скриптами из
    Викисловаря и вычитывается в PR; глагол, составленный моделью, туда попасть не должен;
  • составленные моделью глаголы живут в таблице Verbs со статусом Generated и строкой происхождения
    (VerbProvenances: кто составил, кто одобрил, сколько форм встретилось в текстах, доводы) — оттуда же
    их берёт список для ревизии (GET /api/admin/verbs/model-made, scripts/verbs/model-made.sql);
  • файл с такими глаголами стал бы вторым хранилищем: его пришлось бы сидировать вместе с
    происхождением и держать в согласии с тем, что конвейер дописывает по запросам людей.
Если глагол позже появится в каталоге, сидер перезапишет строку — каталог главнее.

Ключей скрипт не знает: модели и ключ — на сервере. Действуют дневные потолки сервера
(TranslationAgent:MaxGenerationsPerDay); сверх потолка глагол просто не будет составлен — запустите на другой день.
"""
import argparse, hashlib, hmac, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OWNER = ("a1a1a1a1-0000-0000-0000-000000000009", "a1a1a1a1-0000-0000-0000-0000000000a9", 309149393)

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="")
ap.add_argument("--init-data", default=os.environ.get("TRALE_INIT_DATA", ""))
ap.add_argument("--local", action="store_true")
ap.add_argument("--port", default="1421")
ap.add_argument("--container", default="tralebot-ai-db")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--dry", action="store_true", help="только показать список")
args = ap.parse_args()


def local_init_data():
    """Локальный сервер запущен с выдуманным токеном бота; владелец создаётся в локальной базе."""
    user, settings, telegram = OWNER
    subprocess.run(["docker", "exec", args.container, "psql", "-U", "dev", "-d", "tralebot", "-qtAc", f"""
        insert into "Users" ("Id","TelegramId","AccountType","RegisteredAtUtc","UserSettingsId","InitialLanguageSet","IsActive","IsPro","TrialBonusDays","NotificationsEnabled")
        values ('{user}',{telegram},0,now(),'{settings}',true,true,false,0,true) on conflict ("Id") do nothing;
        insert into "UsersSettings" ("Id","UserId","CurrentLanguage") values ('{settings}','{user}',1) on conflict do nothing;"""], check=True)
    fields = {"auth_date": str(int(time.time())), "query_id": "local",
              "user": json.dumps({"id": telegram, "first_name": "Owner"}, separators=(",", ":"))}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", b"local-dev-token", hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


catalog = {v["lemma"] for v in json.load(open(os.path.join(ROOT, "src/Trale/Verbs/verbs.json"), encoding="utf8"))["verbs"]}
wanted = json.load(open(os.path.join(HERE, "wanted.json"), encoding="utf8"))
missing = [w for w in wanted if w["lemma"] not in catalog]
total = len(missing)
if args.limit:
    missing = missing[:args.limit]

print(f"«нужных» глаголов {len(wanted)}, в каталоге нет {total}" + (f", в этом запуске первые {len(missing)}:" if args.limit else ":"))
for w in missing:
    print(f"  {w['ru']} — ожидается {w['lemma']}")
if args.dry:
    sys.exit(0)

url = args.url or f"http://localhost:{args.port}"
auth = local_init_data() if args.local else args.init_data
if not auth:
    sys.exit("нужен --init-data (или переменная TRALE_INIT_DATA) владельца, либо --local")

rows = []
# «говорить, сказать» — два русских слова одного глагола: спрашивается каждое.
asks = [(gloss.strip(), w) for w in missing for gloss in w["ru"].split(",")]
for infinitive, w in asks:
    request = urllib.request.Request(f"{url}/api/admin/verbs/warm-up", data=json.dumps({"text": infinitive}).encode(),
                                     headers={"X-Telegram-Init-Data": auth, "Content-Type": "application/json"})
    started = time.time()
    try:
        answer = json.load(urllib.request.urlopen(request, timeout=300))
    except urllib.error.HTTPError as e:
        answer = {"outcome": f"http {e.code}"}
    answer.update(ru=infinitive, expected=w["lemma"], seconds=time.time() - started)
    rows.append(answer)
    verb = answer.get("verb") or {}
    made = answer.get("provenance")
    what = ("уже в базе" if answer.get("outcome") == "already-there" else
            "составлен и одобрен" if made else
            "взят из таблицы Викисловаря" if verb else
            f"не сохранён ({answer.get('outcome')})")
    print(f"\n«{infinitive}» → {verb.get('lemma') or '—'} | {what} | ответ: {answer.get('definition') or '—'} | {answer['seconds']:.0f} c"
          + ("" if not verb or verb.get("lemma") == w["lemma"] else f" | ВНИМАНИЕ: в списке ожидался {w['lemma']}"))
    if made:
        print(f"   составил {made['generatorModel']}, одобрил {made['reviewerModel']}"
              f"{', после одного исправления' if made['repairRounds'] else ''}; в текстах {made['formsAttested']}/{made['formsTotal']} форм")
        for reason in made["reviewerReasons"]:
            print(f"   довод: {reason}")
        if made["unattestedForms"]:
            print(f"   не встретились в текстах: {', '.join(made['unattestedForms'])}")

made = [r for r in rows if r.get("provenance")]
print(f"\nитог: {len(rows)} глаголов; уже были {sum(r.get('outcome') == 'already-there' for r in rows)}, "
      f"составлено и одобрено {len(made)}, из таблицы Викисловаря {sum(1 for r in rows if r.get('verb') and not r.get('provenance') and r.get('outcome') != 'already-there')}, "
      f"не сохранено {sum(1 for r in rows if not r.get('verb'))}; лемма не та, что в списке: "
      f"{sum(1 for r in rows if r.get('verb') and r['verb'].get('lemma') != r['expected'])}")
print("список для ревизии: GET /api/admin/verbs/model-made или scripts/verbs/model-made.sql")
