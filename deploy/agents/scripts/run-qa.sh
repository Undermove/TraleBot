#!/bin/bash
set -e

# Morning QA run on the shared nightly branch.
# No merging — the branch is already built up sequentially by overnight agents.
# Usage: /scripts/run-qa.sh

source /etc/environment

TODAY=$(date '+%Y-%m-%d')
BRANCH="agents/nightly-${TODAY}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/qa_${TODAY}"
QA_REPORT="qa-report-${TODAY}.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  QA run: ${TODAY}"
echo "  Branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"
git fetch origin --prune --quiet

# Bail if no nightly branch was produced
if ! git ls-remote --exit-code --heads origin "${BRANCH}" > /dev/null 2>&1; then
    echo "No nightly branch ${BRANCH} on origin. Nothing to QA."
    exit 0
fi

git checkout main
git reset --hard origin/main
git checkout -B "${BRANCH}" "origin/${BRANCH}"

# Bail if nothing was committed beyond main
if [ "$(git rev-list main..HEAD --count)" -eq 0 ]; then
    echo "Nightly branch has no commits beyond main. Nothing to QA."
    exit 0
fi

# --- Run QA agent ---------------------------------------------------------------
echo ""
echo ">>> Running QA agent..."
MAX_TURNS="${MAX_TURNS:-50}"

claude \
    -p "Read your role instructions from .claude/agents/qa.md. You are on the shared nightly branch '${BRANCH}'. Overnight agents already built up this branch sequentially — no merging is needed. Your job:
1. Review ALL changes since main (git diff main..HEAD, git log --oneline main..HEAD).
2. Run full QA workflow: build, 'dotnet test', mini-app 'npm run build', check migrations.
3. Fix build/migration blockers you find. Small issues only — large problems go into the PR body as TODO.
4. Write a test-report markdown file at '${QA_REPORT}' in repo root: list of manually-testable cases (Russian is fine).
At the very end output '=== SUMMARY ===' followed by key findings." \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS}" \
    --output-format text \
    --verbose \
    2>&1 | tee "${LOG_DIR}/qa.log"

# Commit QA fixes and the report
if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git add -f src/Trale/wwwroot/ 2>/dev/null || true
    git commit -m "[qa] ${TODAY} fixes and report" 2>/dev/null || true
fi

# Rebuild mini-app to make sure wwwroot is consistent with final source
if [ -d src/Trale/miniapp-src ]; then
    (cd src/Trale/miniapp-src && npm run build) || true
    if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard src/Trale/wwwroot/)" ]; then
        git add -A
        git add -f src/Trale/wwwroot/ 2>/dev/null || true
        git commit -m "[qa] Final mini-app rebuild" 2>/dev/null || true
    fi
fi

# --- Collect context for PR body ------------------------------------------------
QA_SUMMARY=""
if [ -f "${LOG_DIR}/qa.log" ]; then
    QA_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${LOG_DIR}/qa.log" | tail -n +2 | head -30)
fi

QA_REPORT_CONTENT=""
if [ -f "${QA_REPORT}" ]; then
    QA_REPORT_CONTENT=$(cat "${QA_REPORT}")
fi

FILES_CHANGED=$(git diff --stat main..HEAD)
COMMITS=$(git log --oneline main..HEAD)

PR_BODY=$(cat <<PREOF
## Ночной прогон — ${TODAY}

Пять агентов (product → methodist → designer → developer → tech-lead) работали последовательно на одной ветке по ночному расписанию. Утренний QA-агент проверил сборку, тесты и миграции.

<details>
<summary>QA Report</summary>

${QA_REPORT_CONTENT:-_QA-отчёт не сгенерирован_}

</details>

<details>
<summary>QA Agent Summary</summary>

${QA_SUMMARY:-_Summary not extracted_}

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

# --- Push & open PR -------------------------------------------------------------
git push origin "${BRANCH}"

# Create PR only if one doesn't already exist for this branch
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
echo "  QA complete — ${TODAY}"
echo "  $(date)"
echo "============================================"
