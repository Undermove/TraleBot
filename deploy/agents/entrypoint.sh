#!/bin/bash
set -e

echo "=== Бомбора Agent Runner ==="
echo "Starting at $(date)"

# Pass environment to cron jobs (quote values to handle spaces)
# Include PATH so cron jobs can find claude CLI in /usr/local/bin
echo "PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'" > /etc/environment
printenv | grep -E '^(ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|GITHUB_TOKEN|REPO_URL|GIT_USER_NAME|GIT_USER_EMAIL|MAX_TURNS)=' | sed "s/=/='/" | sed "s/$/'/" >> /etc/environment
chmod 644 /etc/environment

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

# Configure git for agent user
su -s /bin/bash agent -c "git config --global user.name '${GIT_USER_NAME:-Bombora Agents}'"
su -s /bin/bash agent -c "git config --global user.email '${GIT_USER_EMAIL:-agents@tralebot.com}'"

# Configure git to use GITHUB_TOKEN for push
AUTHED_URL=$(echo "${REPO_URL}" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")

# Initial clone as agent user (with token in URL for push access)
if [ ! -d /workspace/repo/.git ]; then
    echo "Cloning repo..."
    rm -rf /workspace/repo
    su -s /bin/bash agent -c "git clone '${AUTHED_URL}' /workspace/repo"
else
    echo "Repo already exists, pulling latest..."
    su -s /bin/bash agent -c "cd /workspace/repo && git remote set-url origin '${AUTHED_URL}'"
    su -s /bin/bash agent -c "cd /workspace/repo && git checkout main && git pull origin main"
fi

echo "Cron schedule loaded. Agents will run on schedule."
echo "Logs: /logs/"
echo ""

# Start cron daemon (needs root) and tail logs
cron

touch /logs/agents.log /logs/plan-poller.log
chown agent:agent /logs/agents.log /logs/plan-poller.log

# Start plan-poller as a background daemon (runs as agent, polls every 60s,
# only acts when a sprint-plan issue is open). Wrap in supervisor loop so a
# crash inside the poller (set -e tripping on a transient gh/jq failure, or
# a dying claude subprocess) gets auto-restarted instead of leaving us blind
# until the next reboot.
su -s /bin/bash agent -c 'nohup bash -c "
    while true; do
        /scripts/plan-poller.sh
        rc=\$?
        echo \"[\$(date +%F\\ %T)] [supervisor] plan-poller exited (rc=\$rc), restarting in 30s\" >> /logs/plan-poller.log
        sleep 30
    done
" >> /logs/plan-poller.log 2>&1 &'
echo "plan-poller started under supervisor"

tail -f /logs/agents.log /logs/plan-poller.log
