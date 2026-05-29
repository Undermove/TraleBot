#!/usr/bin/env bash
# Read-only SELECT to TraleBot prod Postgres via port-forward + psql.
# Usage:
#   ./query.sh 'SELECT count(*) FROM "Users"'
#
# See .claude/skills/db-readonly/SKILL.md for full setup instructions
# (kubeconfig, .pgpass, psql).

set -euo pipefail

if [ $# -lt 1 ] || [ -z "${1:-}" ]; then
  echo "Usage: $0 \"<SQL>\"" >&2
  echo "Example: $0 'SELECT count(*) FROM \"Users\"'" >&2
  exit 64
fi
SQL="$1"

# Overridable defaults (see SKILL.md → Кастомизация).
KUBECONFIG_FILE="${TRALEBOT_KUBECONFIG:-$HOME/.kube/tralebot-readonly.conf}"
NS="${TRALEBOT_NAMESPACE:-tralebot-prod}"
POD="${TRALEBOT_POD:-postgres-0}"
DB="${TRALEBOT_DB:-tralebot_db}"
DB_USER="${TRALEBOT_DB_USER:-agent_ro}"
# Стартовый порт. Если занят (например локальный docker-postgres другого
# проекта), скрипт сам найдёт свободный — see free-port loop ниже.
LOCAL_PORT="${TRALEBOT_LOCAL_PORT:-5433}"
LOG="/tmp/tralebot-pgpf.log"

if [ ! -f "$KUBECONFIG_FILE" ]; then
  echo "ERROR: kubeconfig not found: $KUBECONFIG_FILE" >&2
  echo "See .claude/skills/db-readonly/SKILL.md → One-time setup → step 2." >&2
  exit 1
fi

# psql ставится через `brew install libpq` и не попадает в PATH без линковки.
# Добавляем стандартный путь явно — если уже в PATH, ничего не сломается.
export PATH="/usr/local/opt/libpq/bin:$PATH"
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not in PATH. Run: brew install libpq" >&2
  echo "Then add to PATH: echo 'export PATH=\"/usr/local/opt/libpq/bin:\$PATH\"' >> ~/.zshrc" >&2
  exit 1
fi

# Ищем свободный локальный порт начиная с LOCAL_PORT. КРИТИЧНО: если порт уже
# кем-то слушается (частый кейс — docker-postgres другого проекта на 5433),
# kubectl не сможет на него забиндиться, а psql молча уйдёт в ЧУЖУЮ базу. Раньше
# это давало загадочный "password authentication failed for user agent_ro".
# Поэтому форвардим только на заведомо свободный порт.
for _ in $(seq 0 20); do
  nc -z localhost "$LOCAL_PORT" 2>/dev/null || break
  LOCAL_PORT=$((LOCAL_PORT + 1))
done
if nc -z localhost "$LOCAL_PORT" 2>/dev/null; then
  echo "ERROR: не нашёл свободный локальный порт в диапазоне." >&2
  exit 2
fi
if [ "$LOCAL_PORT" != "${TRALEBOT_LOCAL_PORT:-5433}" ]; then
  echo "note: порт $((LOCAL_PORT)) (дефолтный занят), форвардим на него." >&2
fi

KUBECONFIG="$KUBECONFIG_FILE" \
  kubectl port-forward "pod/${POD}" "${LOCAL_PORT}:5432" -n "$NS" \
  >"$LOG" 2>&1 &
PF_PID=$!

# Любой выход (нормальный, ошибка, Ctrl+C) гасит port-forward.
cleanup() {
  kill "$PF_PID" 2>/dev/null || true
  wait "$PF_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Ждём готовности ИМЕННО нашего туннеля: kubectl пишет "Forwarding from
# 127.0.0.1:PORT" когда забиндился. Проверять по nc недостаточно — посторонний
# слушатель на том же порту обманул бы проверку (и psql ушёл бы не туда).
for _ in $(seq 1 20); do
  grep -q "Forwarding from .*:${LOCAL_PORT} " "$LOG" 2>/dev/null && break
  # Если kubectl уже упал (например порт перехватили в гонке) — не ждём зря.
  kill -0 "$PF_PID" 2>/dev/null || break
  sleep 0.3
done

if ! grep -q "Forwarding from .*:${LOCAL_PORT} " "$LOG" 2>/dev/null; then
  echo "ERROR: port-forward не поднялся за ~6с. Лог:" >&2
  cat "$LOG" >&2
  exit 2
fi

# Пароль psql берёт из ~/.pgpass — никаких env-переменных в команде.
psql -h localhost -p "$LOCAL_PORT" -U "$DB_USER" -d "$DB" -c "$SQL"
