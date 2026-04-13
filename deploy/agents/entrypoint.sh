#!/bin/bash
set -e

echo "=== Бомбора Agent Runner ==="
echo "Starting at $(date)"

# Pass environment to cron jobs
printenv | grep -E '^(ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|GITHUB_TOKEN|REPO_URL|GIT_USER_NAME|GIT_USER_EMAIL|MAX_TURNS)=' > /etc/environment

# Validate auth
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN}" ] && [ -z "${ANTHROPIC_API_KEY}" ]; then
    echo "ERROR: Set CLAUDE_CODE_OAUTH_TOKEN (subscription) or ANTHROPIC_API_KEY (API)"
    echo "For subscription: run 'claude setup-token' on your machine"
    exit 1
fi

if [ -n "${CLAUDE_CODE_OAUTH_TOKEN}" ]; then
    echo "Auth: subscription (OAuth token)"
else
    echo "Auth: API key"
fi

# Configure git
git config --global user.name "${GIT_USER_NAME:-Bombora Agents}"
git config --global user.email "${GIT_USER_EMAIL:-agents@tralebot.com}"

# Authenticate gh CLI
echo "${GITHUB_TOKEN}" | gh auth login --with-token 2>/dev/null || echo "Warning: gh auth failed, PRs won't work"

# Initial clone
if [ ! -d /workspace/.git ]; then
    echo "Cloning repo..."
    git clone "${REPO_URL}" /workspace/repo
else
    echo "Repo already exists, pulling latest..."
    cd /workspace/repo && git pull origin main
fi

echo "Cron schedule loaded. Agents will run on schedule."
echo "Logs: /logs/"
echo ""

# Start cron daemon and tail logs
cron
touch /logs/agents.log
tail -f /logs/agents.log
