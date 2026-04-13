#!/bin/bash
# Run a specific agent manually (outside of cron schedule)
# Usage: ./run-manual.sh product|designer|developer|tech-lead

if [ -z "$1" ]; then
    echo "Usage: $0 <agent-name>"
    echo "Available agents: product, designer, developer, tech-lead"
    exit 1
fi

docker exec bombora-agents /scripts/run-agent.sh "$1"
