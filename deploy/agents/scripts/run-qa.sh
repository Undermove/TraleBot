#!/bin/bash
set -e

# Morning PR opener for the shared nightly branch.
# Integration QA already ran every hour as part of run-pipeline.sh.
# This script only: final mini-app rebuild + open/refresh one PR.
# Usage: /scripts/run-qa.sh

source /etc/environment

TODAY=$(date '+%Y-%m-%d')
BRANCH="agents/nightly-${TODAY}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/qa_${TODAY}"
QA_REPORT="qa-report-${TODAY}.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  Morning PR open: ${TODAY}"
echo "  Branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"
git fetch origin --prune --quiet

if ! git ls-remote --exit-code --heads origin "${BRANCH}" > /dev/null 2>&1; then
    echo "No nightly branch ${BRANCH}. Nothing to open."
    exit 0
fi

git checkout main
git reset --hard origin/main
git checkout -B "${BRANCH}" "origin/${BRANCH}"

if [ "$(git rev-list main..HEAD --count)" -eq 0 ]; then
    echo "Branch has no commits beyond main. Nothing to open."
    exit 0
fi

# --- Final mini-app rebuild so wwwroot matches sources --------------------------
if [ -d src/Trale/miniapp-src ]; then
    (cd src/Trale/miniapp-src && npm run build) || true
    if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard src/Trale/wwwroot/)" ]; then
        git add -A
        git add -f src/Trale/wwwroot/ 2>/dev/null || true
        git commit -m "[qa] Final mini-app rebuild ${TODAY}" 2>/dev/null || true
        git push origin "${BRANCH}"
    fi
fi

# --- Build PR body --------------------------------------------------------------
QA_REPORT_CONTENT=""
if [ -f "${QA_REPORT}" ]; then
    QA_REPORT_CONTENT=$(cat "${QA_REPORT}")
fi

# Issues closed or referenced tonight
CLOSED_ISSUES=$(git log main..HEAD --format=%B | grep -iEo '(fixes|closes|resolves)[[:space:]]+#[0-9]+' | grep -oE '#[0-9]+' | sort -u | tr '\n' ' ' || true)
REFERENCED_ISSUES=$(git log main..HEAD --format=%B | grep -iEo 'refs[[:space:]]+#[0-9]+' | grep -oE '#[0-9]+' | sort -u | tr '\n' ' ' || true)

FILES_CHANGED=$(git diff --stat main..HEAD)
COMMITS=$(git log --oneline main..HEAD)

PR_BODY=$(cat <<PREOF
## Ночной прогон — ${TODAY}

Пять агентов (methodist → product → tech-lead → developer → qa) работали последовательно каждый час на общей ветке \`${BRANCH}\`. GitHub issues — источник правды по задачам, интеграционные тесты гоняются каждый час.

**Закрытые задачи:** ${CLOSED_ISSUES:-—}
**Упомянутые задачи:** ${REFERENCED_ISSUES:-—}

<details>
<summary>QA Report (hourly integration)</summary>

${QA_REPORT_CONTENT:-_QA-отчёт не сгенерирован_}

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
*Automated by Bombora Nightly Pipeline — ${TODAY}*
PREOF
)

# --- Open or refresh PR ---------------------------------------------------------
EXISTING_PR=$(gh pr list --head "${BRANCH}" --state open --json number --jq '.[0].number' 2>/dev/null || true)
if [ -n "${EXISTING_PR}" ]; then
    echo ">>> PR #${EXISTING_PR} already exists for ${BRANCH}. Updating body."
    gh pr edit "${EXISTING_PR}" --body "${PR_BODY}" || true
else
    gh pr create \
        --title "Ночной прогон ${TODAY}" \
        --body "${PR_BODY}" \
        --base main \
        --head "${BRANCH}"
fi

git checkout main

echo ""
echo "============================================"
echo "  Morning PR open complete — ${TODAY}"
echo "  $(date)"
echo "============================================"
