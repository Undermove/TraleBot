#!/usr/bin/env python3
"""Ссылка для входа в локальный мини-апп из браузера.

Создаёт в локальной базе тестового пользователя (пробный период активен, уровень выбран,
первый опыт получен) и печатает адрес с initData, подписанным тем же выдуманным токеном,
с которым запущен scripts/dev/run-local-backend.sh. Подпись живёт 24 часа.

    python3 scripts/dev/local-miniapp-url.py            # пользователь с доступом
    python3 scripts/dev/local-miniapp-url.py --expired  # пробный период закончился (пейволл)
    python3 scripts/dev/local-miniapp-url.py --port 1411 --container tralebot-e2e-db   # второй экземпляр
"""
import hashlib, hmac, json, subprocess, sys, time, urllib.parse, urllib.request

TOKEN = "local-dev-token"
USER, SETTINGS, TG = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", 777
registered = "now() - interval '60 days'" if "--expired" in sys.argv else "now()"


def option(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


PORT, CONTAINER = option("--port", "1402"), option("--container", "tralebot-local-dev")


def sql(query):
    subprocess.run(["docker", "exec", CONTAINER, "psql", "-U", "dev", "-d", "tralebot", "-qtAc", query], check=True)


def init_data():
    fields = {"auth_date": str(int(time.time())), "query_id": "local",
              "user": json.dumps({"id": TG, "first_name": "Local"}, separators=(",", ":"))}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


sql(f"""
insert into "Users" ("Id","TelegramId","AccountType","RegisteredAtUtc","UserSettingsId","InitialLanguageSet","IsActive","IsPro","TrialBonusDays","NotificationsEnabled")
values ('{USER}',{TG},0,{registered},'{SETTINGS}',true,true,false,0,true)
on conflict ("Id") do update set "RegisteredAtUtc" = {registered};
insert into "UsersSettings" ("Id","UserId","CurrentLanguage") values ('{SETTINGS}','{USER}',1) on conflict do nothing;
""")
data = init_data()
# Первый вызов /me создаёт строку прогресса; дальше ставим уровень и опыт, чтобы открылась главная.
urllib.request.urlopen(urllib.request.Request(f"http://localhost:{PORT}/api/miniapp/me", headers={"X-Telegram-Init-Data": data})).read()
sql(f"""update "MiniAppUserProgresses" set "Level"='beginner', "Xp"=greatest("Xp",120) where "UserId"='{USER}';""")
print(f"http://localhost:{PORT}/#tgWebAppData=" + urllib.parse.quote(data, safe=""))
