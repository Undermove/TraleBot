#!/bin/sh
# Настоящий сквозной прогон глаголов: мини-апп в браузере против настоящего сервера и настоящей базы.
# Ничего не подменяется: вход — по подписанному initData, ответы на задания берутся из того, что
# страница получила от API, прогресс и опыт проверяются по ответам сервера и по базе.
#
#   scripts/dev/run-real-e2e.sh                  — весь набор
#   scripts/dev/run-real-e2e.sh -g "экзамен"     — только тесты с таким названием (аргументы уходят в playwright)
#   KEEP=1 scripts/dev/run-real-e2e.sh           — не останавливать сервер и базу после прогона (чтобы посмотреть руками)
#
# Свой сервер на http://localhost:1411 и своя база в контейнере tralebot-e2e-db (порт 5451) —
# дев-бот владельца (1402, tralebot-local-dev) не трогается. Скрипт пересобирает мини-апп в
# src/Trale/wwwroot (после прогона `git checkout src/Trale/wwwroot/index.html`, если сборка не нужна)
# и останавливает всё, что запустил. Скриншоты — в каталоге из SHOTS (по умолчанию e2e-real/shots).
# Первый раз нужен браузер: (cd src/Trale/miniapp-src && npx playwright install chromium).
set -e
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

export TRALE_PORT=1411 TRALE_DB_CONTAINER=tralebot-e2e-db TRALE_DB_PORT=5451
LOG="${TMPDIR:-/tmp}/tralebot-e2e-backend.log"

cleanup() {
  [ -n "$KEEP" ] && { echo "KEEP=1: сервер (pid $SERVER) и база $TRALE_DB_CONTAINER оставлены"; return; }
  [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null || true
  # dotnet run порождает дочерний процесс сервера — он слушает порт.
  lsof -tiTCP:"$TRALE_PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  docker rm -f "$TRALE_DB_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if lsof -tiTCP:"$TRALE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Порт $TRALE_PORT занят — остановите прошлый прогон" >&2; trap - EXIT; exit 1
fi
# Каждый прогон — с чистой базой.
docker rm -f "$TRALE_DB_CONTAINER" >/dev/null 2>&1 || true

(cd src/Trale/miniapp-src && npm run build >/dev/null)
# Имена файлов сборки поменялись — старый список статических файлов у dotnet недействителен.
find src/Trale/obj \( -name '*staticwebassets*' -o -name '*.dswa.cache.json' \) -exec rm -rf {} + 2>/dev/null || true

TRALE_SKIP_BUILD=1 sh scripts/dev/run-local-backend.sh >"$LOG" 2>&1 &
SERVER=$!

echo "Жду сервер на :$TRALE_PORT (лог: $LOG)…"
n=0
until curl -sf -o /dev/null "http://localhost:$TRALE_PORT/api/miniapp/content"; do
  n=$((n + 1))
  if [ "$n" -gt 180 ] || ! kill -0 "$SERVER" 2>/dev/null; then echo "Сервер не поднялся:" >&2; tail -30 "$LOG" >&2; exit 1; fi
  sleep 1
done

cd src/Trale/miniapp-src
E2E_BASE_URL="http://localhost:$TRALE_PORT" E2E_DB_CONTAINER="$TRALE_DB_CONTAINER" \
  npx playwright test -c e2e-real/playwright.config.ts "$@"
