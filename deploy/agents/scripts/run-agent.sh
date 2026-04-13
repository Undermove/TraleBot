#!/bin/bash
set -e

# Load environment
source /etc/environment

AGENT_NAME="$1"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
LOG_FILE="/logs/${AGENT_NAME}_${TIMESTAMP}.log"
REPO_DIR="/workspace/repo"

echo ""
echo "============================================"
echo "  Agent: ${AGENT_NAME}"
echo "  Started: $(date)"
echo "  Log: ${LOG_FILE}"
echo "============================================"

# Map agent name to prompt file and role-specific instructions
case "${AGENT_NAME}" in
    product)
        PROMPT_FILE=".claude/agents/product.md"
        BRANCH_PREFIX="claude/product"
        INSTRUCTION="Read your role instructions from ${PROMPT_FILE}. Then execute your session workflow: analyze ROADMAP.md, open issues, open PRs. Generate 2-3 new ideas with learning elements. Update ROADMAP.md and create a PR with your changes."
        ;;
    designer)
        PROMPT_FILE=".claude/agents/designer.md"
        BRANCH_PREFIX="claude/design"
        INSTRUCTION="Read your role instructions from ${PROMPT_FILE}. Then execute your session workflow: find the top [idea] task in ROADMAP.md, create a design spec in design-specs/, update the task status. Create a PR with your changes."
        ;;
    developer)
        PROMPT_FILE=".claude/agents/developer.md"
        BRANCH_PREFIX="claude/dev"
        INSTRUCTION="Read your role instructions from ${PROMPT_FILE}. Then execute your session workflow: find the top [designed] task in ROADMAP.md, read its design spec, implement it, run tests, create a PR."
        ;;
    tech-lead)
        PROMPT_FILE=".claude/agents/tech-lead.md"
        BRANCH_PREFIX="claude/review"
        INSTRUCTION="Read your role instructions from ${PROMPT_FILE}. Then execute your session workflow: find open PRs from claude/* branches, review each one. Leave comments, approve or request changes. If tests are missing, write them."
        ;;
    *)
        echo "Unknown agent: ${AGENT_NAME}"
        exit 1
        ;;
esac

cd "${REPO_DIR}"

# Always work from fresh main
git checkout main
git pull origin main

# Create agent branch
BRANCH="${BRANCH_PREFIX}/${TIMESTAMP}"
git checkout -b "${BRANCH}"

# Run Claude Code
echo "Running Claude Code for ${AGENT_NAME}..."
claude \
    -p "${INSTRUCTION}" \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS:-30}" \
    --output-format stream-json \
    2>&1 | tee "${LOG_FILE}"

# Check if there are changes to push
if git diff --quiet && git diff --staged --quiet; then
    echo "No changes made by ${AGENT_NAME}. Cleaning up branch."
    git checkout main
    git branch -D "${BRANCH}"
else
    echo "Pushing changes..."
    git add -A
    git commit -m "$(cat <<EOF
[${AGENT_NAME}] Automated session ${TIMESTAMP}

Agent: ${AGENT_NAME}
Prompt: ${PROMPT_FILE}

Co-Authored-By: Bombora Agent <agents@tralebot.com>
EOF
)"
    git push origin "${BRANCH}"

    # Create PR
    gh pr create \
        --title "[${AGENT_NAME}] Session ${TIMESTAMP}" \
        --body "$(cat <<EOF
## Agent Session

**Agent:** ${AGENT_NAME}
**Prompt:** \`${PROMPT_FILE}\`
**Branch:** \`${BRANCH}\`

See full log: attached to this run.

---
*Automated by Bombora Agent Runner*
EOF
)" \
        --base main \
        --head "${BRANCH}" \
        || echo "Warning: PR creation failed"
fi

# Return to main for next run
git checkout main

echo ""
echo "${AGENT_NAME} finished at $(date)"
echo "============================================"
