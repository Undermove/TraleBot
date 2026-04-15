#!/bin/bash
set -e

# Полный pipeline: product → designer → developer → tech-lead → summary
# Все работают на одной ветке, один PR в конце с подробным описанием
# Usage: /scripts/run-pipeline.sh

source /etc/environment

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')
BRANCH="claude/pipeline/${TIMESTAMP}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/pipeline_${TIMESTAMP}"
SUMMARY_FILE="${LOG_DIR}/summaries.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  Pipeline: ${TIMESTAMP}"
echo "  Branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"
git checkout main
git pull origin main
git checkout -b "${BRANCH}"

# Max turns per agent
MAX_TURNS_PER_AGENT=(20 25 50 50)

AGENTS=("product" "designer" "developer" "tech-lead")
AGENT_LABELS=("Product" "Designer" "Developer" "Tech Lead")
INSTRUCTIONS=(
    "Read your role instructions from .claude/agents/product.md. Then execute your session workflow: analyze ROADMAP.md, open issues, open PRs. Generate 2-3 new ideas with learning elements. Update ROADMAP.md. Do NOT create a separate PR — just make changes locally, they will be committed after you finish. IMPORTANT: At the very end, output a section starting with '=== SUMMARY ===' followed by a concise markdown summary (3-7 bullet points) of what you did this session."
    "Read your role instructions from .claude/agents/designer.md. Then execute your session workflow: find the top [idea] task in ROADMAP.md, create a design spec in design-specs/, update the task status to [designed]. Do NOT create a separate PR — just make changes locally. IMPORTANT: At the very end, output a section starting with '=== SUMMARY ===' followed by a concise markdown summary (3-7 bullet points) of what you designed."
    "Read your role instructions from .claude/agents/developer.md. Then execute your session workflow: find the top [designed] task in ROADMAP.md, read its design spec from design-specs/, implement it, run tests. Update task status to [review]. Do NOT create a separate PR — just make changes locally. IMPORTANT: At the very end, output a section starting with '=== SUMMARY ===' followed by a concise markdown summary (3-7 bullet points) of what you implemented, what files changed, and test results."
    "Read your role instructions from .claude/agents/tech-lead.md. Review ALL changes on this branch (run git diff main). Check code quality, test coverage, design spec compliance. If you find issues — fix them directly. Run dotnet test. Update task status to [done] if everything passes. Do NOT create a separate PR — just make changes locally. IMPORTANT: At the very end, output a section starting with '=== SUMMARY ===' followed by a concise markdown summary (3-7 bullet points): what you reviewed, what passed, what you fixed."
)

# Clear summaries file
> "${SUMMARY_FILE}"

for i in "${!AGENTS[@]}"; do
    agent="${AGENTS[$i]}"
    label="${AGENT_LABELS[$i]}"
    instruction="${INSTRUCTIONS[$i]}"
    turns="${MAX_TURNS_PER_AGENT[$i]}"
    log_file="${LOG_DIR}/${agent}.log"

    echo ""
    echo ">>> [${agent}] starting at $(date)"

    # Commit any uncommitted changes from previous agent
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "[${AGENTS[$((i-1))]}] automated changes" --allow-empty 2>/dev/null || true
    fi

    claude \
        -p "${instruction}" \
        --dangerously-skip-permissions \
        --max-turns "${turns}" \
        --output-format text \
        --verbose \
        2>&1 | tee "${log_file}"

    # Extract summary from agent output
    AGENT_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${log_file}" | tail -n +2)
    if [ -n "${AGENT_SUMMARY}" ]; then
        echo "### ${label}" >> "${SUMMARY_FILE}"
        echo "" >> "${SUMMARY_FILE}"
        echo "${AGENT_SUMMARY}" >> "${SUMMARY_FILE}"
        echo "" >> "${SUMMARY_FILE}"
    else
        # Fallback: use last 10 lines as summary
        echo "### ${label}" >> "${SUMMARY_FILE}"
        echo "" >> "${SUMMARY_FILE}"
        echo "_Summary not extracted. See full log._" >> "${SUMMARY_FILE}"
        echo "" >> "${SUMMARY_FILE}"
    fi

    echo ">>> [${agent}] finished at $(date)"
done

# Final commit with any remaining changes
if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git commit -m "[tech-lead] final review changes" 2>/dev/null || true
fi

# Check if branch has any commits beyond main
if [ "$(git rev-list main..HEAD --count)" -eq 0 ]; then
    echo ""
    echo "No changes were made by any agent. Cleaning up."
    git checkout main
    git branch -D "${BRANCH}"
    exit 0
fi

# Build file change summary
FILES_CHANGED=$(git diff --stat main)
COMMITS=$(git log main..HEAD --oneline)

# Generate short English summary for PR title and description
echo ""
echo ">>> Generating PR summary..."
PR_SUMMARY_RAW=$(claude \
    -p "Look at the git diff main and agent summaries below. Write:
1. TITLE: short PR title in English (under 60 chars) describing what was done (e.g. 'Progressive section unlock for beginners + quiz numerals')
2. SUMMARY: 2-5 bullet points in English, one line each, describing key features/changes. No technical details — write as if for a product manager.

Agent summaries:
$(cat "${SUMMARY_FILE}")

Response format strictly:
TITLE: ...
SUMMARY:
- ...
- ...
" \
    --dangerously-skip-permissions \
    --max-turns 3 \
    --output-format text \
    2>&1) || true

# Parse title and summary from Claude output
PR_TITLE=$(echo "${PR_SUMMARY_RAW}" | grep "^TITLE:" | head -1 | sed 's/^TITLE: *//')
PR_SHORT_SUMMARY=$(echo "${PR_SUMMARY_RAW}" | sed -n '/^SUMMARY:/,$ p' | tail -n +2 | head -10)

# Fallback if parsing failed
if [ -z "${PR_TITLE}" ]; then
    PR_TITLE="Pipeline ${TIMESTAMP}"
fi
if [ -z "${PR_SHORT_SUMMARY}" ]; then
    PR_SHORT_SUMMARY="_(автоматическое описание не сгенерировалось, см. детали ниже)_"
fi

# Build PR body
PR_BODY=$(cat <<PREOF
## Что сделано

${PR_SHORT_SUMMARY}

---

<details>
<summary>Подробности от агентов</summary>

$(cat "${SUMMARY_FILE}")

</details>

## Коммиты

\`\`\`
${COMMITS}
\`\`\`

## Изменённые файлы

\`\`\`
${FILES_CHANGED}
\`\`\`

---
*Automated by Bombora Agent Pipeline — ${TIMESTAMP}*
PREOF
)

# Push and create PR
echo ""
echo "Pushing branch and creating PR..."
git push origin "${BRANCH}"

gh pr create \
    --title "${PR_TITLE}" \
    --body "${PR_BODY}" \
    --base main \
    --head "${BRANCH}"

git checkout main

echo ""
echo "============================================"
echo "  Pipeline complete!"
echo "  $(date)"
echo "============================================"
