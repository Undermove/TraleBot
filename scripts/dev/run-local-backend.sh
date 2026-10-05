#!/bin/sh
# Локальный запуск бэкенда без Telegram и без дев-бота: своя одноразовая база в Docker,
# выдуманный токен бота (в Telegram сервер не ходит), вебхук не трогается (HostAddress пуст).
# Мини-апп открывается в браузере по ссылке из scripts/dev/local-miniapp-url.py.
#   scripts/dev/run-local-backend.sh          — база + сервер на http://localhost:1402
set -e
cd "$(dirname "$0")/../.."

docker inspect tralebot-local-dev >/dev/null 2>&1 || docker run -d --name tralebot-local-dev \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=dev -e POSTGRES_DB=tralebot -p 5441:5432 postgres:16.1 >/dev/null
docker start tralebot-local-dev >/dev/null
until docker exec tralebot-local-dev pg_isready -U dev -q; do sleep 1; done

# Свежая сборка мини-аппа, чтобы сервер отдавал текущий фронтенд.
(cd src/Trale/miniapp-src && npm run build >/dev/null)

export ASPNETCORE_ENVIRONMENT=localdev
export ConnectionStrings__TraleBotDb="Host=localhost;Port=5441;Database=tralebot;Username=dev;Password=dev"
export BotConfiguration__Token="local-dev-token"
export BotConfiguration__HostAddress=""
export BotConfiguration__WebhookToken="local"
export BotConfiguration__PaymentProviderToken="local"
export OpenAiConfiguration__ApiKey="local"
exec dotnet run --project src/Trale --no-launch-profile
