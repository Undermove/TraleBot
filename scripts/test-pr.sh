#!/bin/bash
# Usage: ./scripts/test-pr.sh <PR_NUMBER>
# Переключает локальный TraleBot на ветку PR, пересобирает фронт и перезапускает backend.
# Требования: работающий ngrok + tralebot-db-1 в Docker.

set -e

PR_NUMBER="${1:-}"
if [ -z "${PR_NUMBER}" ]; then
    echo "Usage: $0 <PR_NUMBER>"
    echo ""
    echo "Open PRs:"
    gh pr list --state open --limit 20
    exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_DIR}"

echo "=== Testing PR #${PR_NUMBER} ==="

# 1. Kill running dotnet processes
echo ">>> Killing running TraleBot processes..."
ps aux | grep "Trale" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true
sleep 1

# 2. Checkout PR
echo ">>> Checking out PR #${PR_NUMBER}..."
gh pr checkout "${PR_NUMBER}"

# 3. Rebuild frontend
echo ">>> Building frontend..."
cd "${REPO_DIR}/src/Trale/miniapp-src"
npm install --silent 2>/dev/null
npm run build

# 4. Verify ngrok is running and webhook is pointing to it
echo ">>> Verifying ngrok tunnel..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'] if d.get('tunnels') else '')" 2>/dev/null || echo "")
if [ -z "${NGROK_URL}" ]; then
    echo "ERROR: ngrok is not running. Start it with: ngrok http 1402"
    exit 1
fi
echo "ngrok URL: ${NGROK_URL}"

# 5. Start backend in background
echo ">>> Starting TraleBot backend..."
cd "${REPO_DIR}"
nohup dotnet run --project src/Trale/Trale.csproj --environment Development > /tmp/tralebot-dev.log 2>&1 &

# 6. Wait for server to be ready
echo ">>> Waiting for server to start..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:1402/ 2>/dev/null | grep -q 200; then
        echo "Server is up!"
        break
    fi
    sleep 1
done

# 7. Show summary
echo ""
echo "=== Ready to test PR #${PR_NUMBER} ==="
echo "Local:   http://localhost:1402"
echo "Public:  ${NGROK_URL}"
echo "Logs:    tail -f /tmp/tralebot-dev.log"
echo ""
echo "Send messages to your Telegram bot to test."
