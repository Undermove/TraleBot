#!/bin/sh
# Локальный запуск бэкенда без Telegram и без дев-бота: своя одноразовая база в Docker,
# выдуманный токен бота (в Telegram сервер не ходит), вебхук не трогается (HostAddress пуст).
# Мини-апп открывается в браузере по ссылке из scripts/dev/local-miniapp-url.py.
#   scripts/dev/run-local-backend.sh          — база + сервер на http://localhost:1402
# Второй экземпляр рядом с первым (свой порт и своя база) — через переменные окружения:
#   TRALE_PORT=1411 TRALE_DB_CONTAINER=tralebot-e2e-db TRALE_DB_PORT=5451 scripts/dev/run-local-backend.sh
#   TRALE_SKIP_BUILD=1 — не пересобирать мини-апп (его уже собрал вызывающий скрипт).
set -e
cd "$(dirname "$0")/../.."

PORT="${TRALE_PORT:-1402}"
DB_CONTAINER="${TRALE_DB_CONTAINER:-tralebot-local-dev}"
DB_PORT="${TRALE_DB_PORT:-5441}"

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || docker run -d --name "$DB_CONTAINER" \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=dev -e POSTGRES_DB=tralebot -p "$DB_PORT":5432 postgres:16.1 >/dev/null
docker start "$DB_CONTAINER" >/dev/null
until docker exec "$DB_CONTAINER" pg_isready -U dev -q; do sleep 1; done

# Свежая сборка мини-аппа, чтобы сервер отдавал текущий фронтенд.
[ -n "$TRALE_SKIP_BUILD" ] || (cd src/Trale/miniapp-src && npm run build >/dev/null)

export ASPNETCORE_ENVIRONMENT=localdev
export ConnectionStrings__TraleBotDb="Host=localhost;Port=$DB_PORT;Database=tralebot;Username=dev;Password=dev"
# 1402 — порт по умолчанию, его сервер берёт сам; другой передаём явно (см. Program.cs, ключ HostUrls).
[ "$PORT" = "1402" ] || export HostUrls="http://localhost:$PORT"
export BotConfiguration__Token="local-dev-token"
export BotConfiguration__HostAddress=""
export BotConfiguration__WebhookToken="local"
export BotConfiguration__PaymentProviderToken="local"
export OpenAiConfiguration__ApiKey="local"
exec dotnet run --project src/Trale --no-launch-profile
