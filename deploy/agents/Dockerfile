FROM node:20-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    gh \
    cron \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create workspace
RUN mkdir -p /workspace /logs /scripts
WORKDIR /workspace

# Copy agent runner scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Copy crontab
COPY crontab /etc/cron.d/agents-cron
RUN chmod 0644 /etc/cron.d/agents-cron && crontab /etc/cron.d/agents-cron

# Entrypoint: start cron in foreground + tail logs
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
