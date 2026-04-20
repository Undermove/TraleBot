FROM node:20-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    gh \
    cron \
    curl \
    jq \
    tzdata \
    ca-certificates \
    gpg \
    && rm -rf /var/lib/apt/lists/*

# Default timezone (overridable via TZ env var)
ENV TZ=Asia/Tbilisi
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# --- .NET 10 SDK (official Microsoft packages) ---------------------------------
# Needed so: (a) developer/qa agents can actually run `dotnet test` (previously
# silently failed — no SDK in image), (b) the dotnet/skills LSP server
# (roslyn-language-server) is usable by the developer/tech-lead/qa agents.
RUN curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o /tmp/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y dotnet-sdk-10.0 \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash agent

# Create workspace
RUN mkdir -p /workspace /logs /scripts && chown -R agent:agent /workspace /logs /scripts
WORKDIR /workspace

# --- Official .NET Agent Skills (dotnet/skills by Microsoft .NET team) ---------
# Cloned at image-build time so the pipeline agents can load them headlessly via
# `claude --plugin-dir /opt/dotnet-skills/plugins/<plugin>`. The marketplace
# install flow (`/plugin marketplace add dotnet/skills`) is interactive and
# doesn't fit our cron-driven CLI setup, so we vendor via git clone.
# Pinned to main (shallow clone) — update by rebuilding the image.
RUN git clone --depth 1 https://github.com/dotnet/skills.git /opt/dotnet-skills \
    && chown -R agent:agent /opt/dotnet-skills

# Pre-warm the Roslyn language server nuget cache as the `agent` user so the
# first agent run doesn't stall on a first-time download. Falls back to a
# no-op if the package can't be fetched offline — we log but don't fail the
# build, because a later `dotnet dnx` call will still retry.
USER agent
RUN dotnet dnx roslyn-language-server --yes --prerelease -- --version 2>/dev/null || true
USER root

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
