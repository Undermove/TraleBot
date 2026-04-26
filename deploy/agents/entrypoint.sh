#!/bin/bash
set -e

echo "=== Бомбора Agent Runner ==="
echo "Starting at $(date)"

# Pass environment to cron jobs (quote values to handle spaces)
# Include PATH so cron jobs can find claude CLI in /usr/local/bin
echo "PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'" > /etc/environment
printenv | grep -E '^(ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|GITHUB_TOKEN|REPO_URL|GIT_USER_NAME|GIT_USER_EMAIL|MAX_TURNS|TESTCONTAINERS_RYUK_DISABLED|TESTCONTAINERS_HOST_OVERRIDE)=' | sed "s/=/='/" | sed "s/$/'/" >> /etc/environment
chmod 644 /etc/environment

# Grant agent user access to the Docker socket so Testcontainers can spawn
# Postgres sibling containers during IntegrationTests. The socket GID may differ
# between hosts, so we resolve it dynamically rather than hardcoding it.
if [ -e /var/run/docker.sock ]; then
    SOCK_GID=$(stat -c '%g' /var/run/docker.sock)
    if ! getent group "$SOCK_GID" > /dev/null 2>&1; then
        groupadd -g "$SOCK_GID" dockersock
    fi
    SOCK_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1)
    usermod -aG "$SOCK_GROUP" agent
    # Also change socket group to agent's primary group so access is immediate.
    # usermod takes effect only at next login; chgrp takes effect right away,
    # so cron-spawned processes can reach the socket without a container restart.
    chgrp agent /var/run/docker.sock
    echo "Docker socket: GID=$SOCK_GID group=$SOCK_GROUP — agent added, socket chgrp→agent"
else
    echo "Docker socket not found — IntegrationTests will run without Testcontainers"
fi

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
touch /logs/agents.log
chown agent:agent /logs/agents.log
tail -f /logs/agents.log
